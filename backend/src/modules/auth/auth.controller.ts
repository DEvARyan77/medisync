import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";
import { User } from "./user.model";
import { createStaffSchema, loginSchema, registerPatientSchema } from "./auth.schema";

function signToken(id: string, role: string): string {
  return jwt.sign({ id, role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

function publicUser(user: { toObject(): Record<string, unknown> }) {
  const { password: _password, __v: _v, ...rest } = user.toObject();
  return rest;
}

// POST /api/auth/register  (patients sign themselves up)
export async function registerPatient(req: Request, res: Response) {
  const data = registerPatientSchema.parse(req.body);
  const user = await User.create({ ...data, role: "patient" });
  res.status(201).json({ token: signToken(user.id, user.role), user: publicUser(user) });
}

// POST /api/auth/staff  (admin creates doctors, receptionists, pharmacists)
export async function createStaff(req: Request, res: Response) {
  const data = createStaffSchema.parse(req.body);
  const user = await User.create(data);
  res.status(201).json({ user: publicUser(user) });
}

// POST /api/auth/login
export async function login(req: Request, res: Response) {
  const { email, password } = loginSchema.parse(req.body);
  const user = await User.findOne({ email }).select("+password");
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
