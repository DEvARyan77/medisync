import { Request, Response } from "express";
import { z } from "zod";
import { ApiError } from "../../utils/ApiError";
import { User } from "../auth/user.model";
import { publicUser } from "../auth/auth.controller";
import { alternateEmail } from "../auth/auth.schema";
import { sendEmail } from "../../services/email";
import { passwordChangedEmail } from "../../services/emailTemplates";

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
export async function changeMyPassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = z
    .object({ currentPassword: z.string().min(1), newPassword: z.string().min(6, "Use at least 6 characters") })
    .parse(req.body);

  const user = await User.findById(req.user!.id).select("+password");
  if (!user) throw new ApiError(404, "User not found");
  const ok = await (user as unknown as { comparePassword(p: string): Promise<boolean> }).comparePassword(currentPassword);
  if (!ok) throw new ApiError(400, "Current password is wrong");
  if (currentPassword === newPassword) throw new ApiError(400, "New password must be different");

  user.password = newPassword; // hashed by the save hook
  await user.save();
  sendEmail({ to: user.email, cc: user.alternateEmail, name: user.name, ...passwordChangedEmail(user.name) });
  res.json({ message: "Password changed" });
}
