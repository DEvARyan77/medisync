import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authorize, protect } from "../../middleware/auth";
import { createStaff, login, me, registerPatient } from "./auth.controller";

const router = Router();

router.post("/register", asyncHandler(registerPatient));
router.post("/login", asyncHandler(login));
router.get("/me", protect, asyncHandler(me));
router.post("/staff", protect, authorize("admin"), asyncHandler(createStaff));

export default router;
