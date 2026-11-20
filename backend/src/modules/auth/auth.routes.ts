import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authorize, protect } from "../../middleware/auth";
import { createStaff, forgotPassword, login, me, registerPatient, resetPassword } from "./auth.controller";

const router = Router();

router.post("/register", asyncHandler(registerPatient));
router.post("/login", asyncHandler(login));
router.post("/forgot-password", asyncHandler(forgotPassword));
router.post("/reset-password", asyncHandler(resetPassword));
router.get("/me", protect, asyncHandler(me));
router.post("/staff", protect, authorize("admin"), asyncHandler(createStaff));

export default router;
