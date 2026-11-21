import { Request, Response } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { sendEmail } from "../../services/email";
import { emailEnabled, sendEmailAndWait } from "../../services/email";
import { otpEmail, passwordChangedEmail, passwordResetEmail, staffWelcomeEmail, welcomeEmail } from "../../services/emailTemplates";
import { consumeOtp, issueOtp, OTP_MINUTES } from "./otp";
import { socialConfig, SocialProfile, verifyFacebook, verifyGoogle } from "./social";
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

// POST /api/auth/register/send-code  { email }
// Step 1 of sign-up: email a 6-digit code. Limited per email (1/minute, 5/hour) and per network.
export async function sendSignupCode(req: Request, res: Response) {
  const { email } = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email") }).parse(req.body);
  if (email.endsWith("@medisync.dev")) throw new ApiError(400, "Use your own email address: we send a code to it.");
  if (await User.exists({ email })) throw new ApiError(409, "An account with this email already exists. Sign in instead.");
  const code = await issueOtp(email, req.ip ?? "unknown");
  if (!emailEnabled()) {
    // Local development without Brevo: show the code in the server log
    console.log(`[email] (not configured) sign-up code for ${email}: ${code}`);
  } else {
    try {
      await sendEmailAndWait({ to: email, ...otpEmail(code, OTP_MINUTES) });
    } catch (err) {
      console.error("[email] sign-up code failed:", (err as Error).message);
      throw new ApiError(502, "We couldn't send the code to this email. Check the address and try again.");
    }
  }
  res.json({ message: `We sent a 6-digit code to ${email}. It works for ${OTP_MINUTES} minutes.`, minutes: OTP_MINUTES });
}

// POST /api/auth/register  (patients sign themselves up, with the emailed code)
export async function registerPatient(req: Request, res: Response) {
  const { otp, ...data } = registerPatientSchema.parse(req.body);
  data.email = data.email.toLowerCase();
  if (await User.exists({ email: data.email })) throw new ApiError(409, "An account with this email already exists. Sign in instead.");
  await consumeOtp(data.email, otp);
  const user = await User.create({ ...data, role: "patient", emailVerified: true });
  sendEmail({ to: user.email, cc: user.alternateEmail, name: user.name, ...welcomeEmail(user.name) });
  res.status(201).json({ token: signToken(user.id, user.role), user: publicUser(user) });
}

// POST /api/auth/staff  (admin creates doctors, receptionists, pharmacists)
export async function createStaff(req: Request, res: Response) {
  const data = createStaffSchema.parse(req.body);
  const user = await User.create(data);
  sendEmail({ to: user.email, cc: user.alternateEmail, name: user.name, ...staffWelcomeEmail(user.name, user.role) });
  res.status(201).json({ user: publicUser(user) });
}

const RESET_MINUTES = 30;
const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

// POST /api/auth/forgot-password  { email }
// Always answers the same way, so nobody can use it to find out which emails are registered.
export async function forgotPassword(req: Request, res: Response) {
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  const address = email.toLowerCase();
  // Works with the main email or the alternate one; the link goes to both.
  const user = (await User.findOne({ email: address })) ?? (await User.findOne({ alternateEmail: address }));
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    user.set({ passwordResetTokenHash: hashToken(token), passwordResetExpires: new Date(Date.now() + RESET_MINUTES * 60_000) });
    await user.save();
    const base = env.clientUrl.split(",")[0];
    const url = `${base}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;
    sendEmail({ to: user.email, cc: user.alternateEmail, name: user.name, ...passwordResetEmail({ name: user.name, url, minutes: RESET_MINUTES }) });
  }
  res.json({ message: "If that email is registered, a reset link is on its way (to your main and alternate email)." });
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
  sendEmail({ to: user.email, cc: user.alternateEmail, name: user.name, ...passwordChangedEmail(user.name) });
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

// GET /api/auth/social-config: which sign-in buttons to show (public client ids only)
export function getSocialConfig(_req: Request, res: Response) {
  res.json(socialConfig());
}

/** Finds the account for a Google/Facebook profile (by provider id, then email), or creates a patient. */
async function socialSignIn(profile: SocialProfile, res: Response) {
  let user =
    (await User.findOne({ authProviders: { $elemMatch: { provider: profile.provider, providerId: profile.providerId } } })) ??
    (await User.findOne({ email: profile.email }));
  let created = false;
  if (!user) {
    user = await User.create({
      name: profile.name,
      email: profile.email,
      // never used to sign in: the account has no password until the user sets one
      password: crypto.randomBytes(24).toString("hex"),
      hasPassword: false,
      role: "patient",
      emailVerified: true,
      authProviders: [{ provider: profile.provider, providerId: profile.providerId }],
    });
    created = true;
    sendEmail({ to: user.email, name: user.name, ...welcomeEmail(user.name) });
  } else if (!user.authProviders?.some((p) => p.provider === profile.provider)) {
    // The email is verified by Google/Facebook, so the provider can be linked to the existing account
    user.authProviders.push({ provider: profile.provider, providerId: profile.providerId });
    user.emailVerified = true;
    await user.save();
  }
  res.status(created ? 201 : 200).json({ token: signToken(user.id, user.role), user: publicUser(user), created });
}

// POST /api/auth/google  { credential }  (ID token from Google Identity Services)
export async function googleSignIn(req: Request, res: Response) {
  const { credential } = z.object({ credential: z.string().min(20) }).parse(req.body);
  await socialSignIn(await verifyGoogle(credential), res);
}

// POST /api/auth/facebook  { accessToken }
export async function facebookSignIn(req: Request, res: Response) {
  const { accessToken } = z.object({ accessToken: z.string().min(20) }).parse(req.body);
  await socialSignIn(await verifyFacebook(accessToken), res);
}

// GET /api/auth/me
export async function me(req: Request, res: Response) {
  const user = await User.findById(req.user!.id);
  if (!user || user.deletedAt) throw new ApiError(401, "This account no longer exists");
  res.json({ user: publicUser(user) });
}
