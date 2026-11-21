import crypto from "crypto";
import { Request, Response } from "express";
import { z } from "zod";
import { ApiError } from "../../utils/ApiError";
import { User } from "../auth/user.model";
import { publicUser } from "../auth/auth.controller";
import { alternateEmail } from "../auth/auth.schema";
import { sendEmail } from "../../services/email";
import { accountDeletedEmail, passwordChangedEmail } from "../../services/emailTemplates";
import { Appointment } from "../appointments/appointment.model";
import { ACTIVE_TRIP_STATUSES, AmbulanceRequest } from "../ambulance/ambulance.model";
import { clinicToday } from "../../utils/clinicTime";

const optionalText = z.string().trim().max(200).optional();

// Fields every role may edit about themselves.
export const baseSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().regex(/^[0-9+\- ]{6,15}$/, "Enter a valid phone number").optional().or(z.literal("")),
  alternateEmail,
});

// Extra fields a patient may edit.
export const patientSchema = baseSchema.extend({
  gender: z.enum(["male", "female", "other"]).optional(),
  dateOfBirth: z.coerce
    .date()
    .refine((d) => d <= new Date(), "Date of birth cannot be in the future")
    .optional()
    .nullable(),
  allergies: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional().nullable(),
  address: optionalText,
  emergencyContact: z
    .object({ name: optionalText, phone: optionalText, relation: optionalText })
    .optional(),
});

// PATCH /api/users/me
export async function updateMyProfile(req: Request, res: Response) {
  const isPatient = req.user!.role === "patient";
  const data = (isPatient ? patientSchema : baseSchema).strict().parse(req.body);

  const user = await User.findById(req.user!.id);
  if (!user) throw new ApiError(404, "User not found");
  if (data.alternateEmail && data.alternateEmail === user.email) {
    throw new ApiError(400, "Alternate email must be different from your main email");
  }
  user.set(data);
  await user.save();
  res.json({ user: publicUser(user) });
}

// PATCH /api/users/me/password  { currentPassword, newPassword }
// Accounts made with Google/Facebook have no password yet: they set one without currentPassword.
export async function changeMyPassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = z
    .object({ currentPassword: z.string().optional(), newPassword: z.string().min(6, "Use at least 6 characters") })
    .parse(req.body);

  const user = await User.findById(req.user!.id).select("+password");
  if (!user) throw new ApiError(404, "User not found");
  if (user.hasPassword !== false) {
    if (!currentPassword) throw new ApiError(400, "Enter your current password");
    const ok = await (user as unknown as { comparePassword(p: string): Promise<boolean> }).comparePassword(currentPassword);
    if (!ok) throw new ApiError(400, "Current password is wrong");
    if (currentPassword === newPassword) throw new ApiError(400, "New password must be different");
  }

  user.password = newPassword; // hashed by the save hook
  user.hasPassword = true;
  await user.save();
  sendEmail({ to: user.email, cc: user.alternateEmail, name: user.name, ...passwordChangedEmail(user.name) });
  res.json({ message: "Password changed" });
}

// DELETE /api/users/me  { password? , confirm: "DELETE" }
// The account can't be used again. Medical records the clinic must keep stay, but no longer carry
// the person's name, email or phone; upcoming appointments and open ambulance requests are cancelled.
export async function deleteMyAccount(req: Request, res: Response) {
  const { password, confirm } = z.object({ password: z.string().optional(), confirm: z.string() }).parse(req.body);
  if (confirm.trim().toUpperCase() !== "DELETE") throw new ApiError(400, 'Type DELETE to confirm');
  const user = await User.findById(req.user!.id).select("+password");
  if (!user) throw new ApiError(404, "User not found");
  if (user.role === "admin") throw new ApiError(400, "Admin accounts can't be deleted here. Ask another admin.");
  if (user.hasPassword !== false) {
    const ok = password && (await (user as unknown as { comparePassword(p: string): Promise<boolean> }).comparePassword(password));
    if (!ok) throw new ApiError(400, "Your password is wrong");
  }

  const { name, email, alternateEmail } = user;
  if (user.role === "patient") {
    await Appointment.updateMany({ patient: user._id, status: "booked", date: { $gte: clinicToday() } }, { status: "cancelled" });
    await AmbulanceRequest.updateMany(
      { patient: user._id, status: { $in: ACTIVE_TRIP_STATUSES } },
      { status: "cancelled", $push: { timeline: { status: "cancelled", at: new Date() } } }
    );
  }
  // Anonymise instead of removing, so past prescriptions and visits stay consistent for the clinic
  user.set({
    name: "Deleted user",
    email: `deleted-${user.id}@deleted.invalid`,
    alternateEmail: undefined,
    phone: undefined,
    address: undefined,
    emergencyContact: undefined,
    dateOfBirth: undefined,
    authProviders: [],
    password: crypto.randomBytes(24).toString("hex"),
    hasPassword: false,
    isAvailable: false,
    deletedAt: new Date(),
  });
  await user.save();
  sendEmail({ to: email, cc: alternateEmail, name, ...accountDeletedEmail(name) });
  res.json({ message: "Your account has been deleted." });
}
