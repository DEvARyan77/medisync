import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authorize, protect } from "../../middleware/auth";
import {
  createStaff,
  facebookSignIn,
  forgotPassword,
  getSocialConfig,
  googleSignIn,
  login,
  me,
  registerPatient,
  resetPassword,
  sendSignupCode,
} from "./auth.controller";

const router = Router();

router.post("/register/send-code", asyncHandler(sendSignupCode));
router.post("/register", asyncHandler(registerPatient));
router.get("/social-config", getSocialConfig);
router.post("/google", asyncHandler(googleSignIn));
router.post("/facebook", asyncHandler(facebookSignIn));
router.post("/login", asyncHandler(login));
router.post("/forgot-password", asyncHandler(forgotPassword));
router.post("/reset-password", asyncHandler(resetPassword));
router.get("/me", protect, asyncHandler(me));
router.post("/staff", protect, authorize("admin"), asyncHandler(createStaff));

export default router;
