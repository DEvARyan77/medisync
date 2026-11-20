import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authorize, protect } from "../../middleware/auth";
import { createConsultation, patientHistory } from "./consultation.controller";

const router = Router();

router.use(protect);
router.post("/", authorize("doctor"), asyncHandler(createConsultation));
router.get("/patient/:patientId", authorize("doctor", "patient", "admin"), asyncHandler(patientHistory));

export default router;
