import { Router, Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authorize, protect } from "../../middleware/auth";
import { User } from "../auth/user.model";
import { changeMyPassword, deleteMyAccount, updateMyProfile } from "./profile.controller";

const router = Router();

// Own profile (every role)
router.patch("/me", protect, asyncHandler(updateMyProfile));
router.patch("/me/password", protect, asyncHandler(changeMyPassword));
router.delete("/me", protect, asyncHandler(deleteMyAccount));

// GET /api/users/doctors?department=Cardiology  (anyone logged in, used for booking)
router.get(
  "/doctors",
  protect,
  asyncHandler(async (req: Request, res: Response) => {
    const filter: Record<string, unknown> = { role: "doctor", deletedAt: { $exists: false } };
    if (typeof req.query.department === "string") filter.department = req.query.department;
    const doctors = await User.find(filter).select("name department specialization");
    res.json({ doctors });
  })
);

// GET /api/users/patients?q=name-or-phone  (staff searches patients)
router.get(
  "/patients",
  protect,
  authorize("receptionist", "doctor", "admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const filter: Record<string, unknown> = { role: "patient", deletedAt: { $exists: false } };
    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [{ name: new RegExp(escaped, "i") }, { phone: new RegExp(escaped) }];
    }
    const patients = await User.find(filter).select("name email phone gender dateOfBirth allergies").limit(20);
    res.json({ patients });
  })
);

// GET /api/users  (admin sees everyone)
router.get(
  "/",
  protect,
  authorize("admin"),
  asyncHandler(async (_req: Request, res: Response) => {
    const users = await User.find().sort({ role: 1, name: 1 });
    res.json({ users });
  })
);

export default router;
