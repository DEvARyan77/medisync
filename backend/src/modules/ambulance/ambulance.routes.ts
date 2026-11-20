import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authorize, protect } from "../../middleware/auth";
import {
  acceptTrip,
  allActive,
  currentTrip,
  myTrips,
  nearbyAmbulances,
  openRequests,
  requestAmbulance,
  setAvailability,
  updateLocation,
  updateTripStatus,
} from "./ambulance.controller";

const router = Router();

router.use(protect);
router.post("/", authorize("patient", "receptionist", "admin"), asyncHandler(requestAmbulance));
router.get("/", authorize("receptionist", "admin"), asyncHandler(allActive));
router.get("/nearby", asyncHandler(nearbyAmbulances));
router.get("/mine", authorize("patient"), asyncHandler(myTrips));
router.get("/open", authorize("driver"), asyncHandler(openRequests));
router.get("/current", authorize("driver"), asyncHandler(currentTrip));
router.patch("/availability", authorize("driver"), asyncHandler(setAvailability));
router.patch("/location", authorize("driver"), asyncHandler(updateLocation));
router.patch("/:id/accept", authorize("driver"), asyncHandler(acceptTrip));
router.patch("/:id/status", asyncHandler(updateTripStatus));

export default router;
