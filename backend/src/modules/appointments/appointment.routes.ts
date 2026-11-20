import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authorize, protect } from "../../middleware/auth";
import {
  bookAppointment,
  getAvailableSlots,
  getQueue,
  myAppointments,
  updateStatus,
} from "./appointment.controller";

const router = Router();

router.use(protect);
router.get("/slots", asyncHandler(getAvailableSlots));
router.post("/", authorize("patient", "receptionist", "admin"), asyncHandler(bookAppointment));
router.get("/mine", authorize("patient"), asyncHandler(myAppointments));
router.get("/queue", authorize("receptionist", "doctor", "admin"), asyncHandler(getQueue));
router.patch("/:id/status", asyncHandler(updateStatus));

export default router;
