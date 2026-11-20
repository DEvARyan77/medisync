import { Request, Response } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { sendEmail } from "../../services/email";
import { passwordChangedEmail, passwordResetEmail, staffWelcomeEmail, welcomeEmail } from "../../services/emailTemplates";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";
import { User } from "./user.model";
import { createStaffSchema, loginSchema, registerPatientSchema } from "./auth.schema";

function signToken(id: string, role: string): string {
  return jwt.sign({ id, role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

export function publicUser(user: { toObject(): Record<string, unknown> }) {
  const {
    password: _password,
    passwordResetTokenHash: _h,
    passwordResetExpires: _e,
    __v: _v,
    location: _l,
    ...rest
  } = user.toObject();
  return rest;
}

// POST /api/auth/register  (patients sign themselves up)
export async function registerPatient(req: Request, res: Response) {
  const data = registerPatientSchema.parse(req.body);
  const user = await User.create({ ...data, role: "patient" });
  sendEmail({ to: user.email, name: user.name, ...welcomeEmail(user.name) });
  res.status(201).json({ token: signToken(user.id, user.role), user: publicUser(user) });
}

// POST /api/auth/staff  (admin creates doctors, receptionists, pharmacists)
export async function createStaff(req: Request, res: Response) {
  const data = createStaffSchema.parse(req.body);
  const user = await User.create(data);
  sendEmail({ to: user.email, name: user.name, ...staffWelcomeEmail(user.name, user.role) });
  res.status(201).json({ user: publicUser(user) });
}

const RESET_MINUTES = 30;
const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

// POST /api/auth/forgot-password  { email }
// Always answers the same way, so nobody can use it to find out which emails are registered.
export async function forgotPassword(req: Request, res: Response) {
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  const user = await User.findOne({ email: email.toLowerCase() });
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    user.set({ passwordResetTokenHash: hashToken(token), passwordResetExpires: new Date(Date.now() + RESET_MINUTES * 60_000) });
    await user.save();
    const base = env.clientUrl.split(",")[0];
    const url = `${base}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;
    sendEmail({ to: user.email, name: user.name, ...passwordResetEmail({ name: user.name, url, minutes: RESET_MINUTES }) });
  }
  res.json({ message: "If that email is registered, a reset link is on its way." });
}

// POST /api/auth/reset-password  { email, token, password }
export async function resetPassword(req: Request, res: Response) {
  const { email, token, password } = z
    .object({ email: z.string().email(), token: z.string().length(64), password: z.string().min(6, "Use at least 6 characters") })
    .parse(req.body);

  const user = await User.findOne({
    email: email.toLowerCase(),
    passwordResetTokenHash: hashToken(token),
    passwordResetExpires: { $gt: new Date() },
  }).select("+passwordResetTokenHash +passwordResetExpires");
  if (!user) throw new ApiError(400, "This reset link is invalid or has expired. Please request a new one.");

  user.password = password;
  user.set({ passwordResetTokenHash: undefined, passwordResetExpires: undefined }); // link works only once
  await user.save();
  sendEmail({ to: user.email, name: user.name, ...passwordChangedEmail(user.name) });
  res.json({ token: signToken(user.id, user.role), user: publicUser(user) });
}

// POST /api/auth/login
export async function login(req: Request, res: Response) {
  const { email, password } = loginSchema.parse(req.body);
  const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
  if (!user || !(await (user as unknown as { comparePassword(p: string): Promise<boolean> }).comparePassword(password))) {
    throw new ApiError(401, "Wrong email or password");
  }
  res.json({ token: signToken(user.id, user.role), user: publicUser(user) });
}

// GET /api/auth/me
export async function me(req: Request, res: Response) {
  const user = await User.findById(req.user!.id);
  if (!user) throw new ApiError(404, "User not found");
  res.json({ user: publicUser(user) });
}
