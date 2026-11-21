import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";
import { Role, User } from "../modules/auth/user.model";

export interface AuthUser {
  id: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Verifies the "Authorization: Bearer <token>" header.
export function protect(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(new ApiError(401, "Not logged in"));

  let payload: AuthUser;
  try {
    payload = jwt.verify(header.slice(7), env.jwtSecret) as AuthUser;
  } catch {
    return next(new ApiError(401, "Invalid or expired token"));
  }
  // A deleted account's token stops working at once (tokens otherwise last 7 days)
  User.exists({ _id: payload.id, deletedAt: { $exists: false } })
    .then((found) => {
      if (!found) return next(new ApiError(401, "This account no longer exists"));
      req.user = { id: payload.id, role: payload.role };
      next();
    })
    .catch(next);
}

// Allows only the listed roles, e.g. authorize("doctor", "admin").
export const authorize =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ApiError(403, "You do not have access to this action"));
    }
    next();
  };
