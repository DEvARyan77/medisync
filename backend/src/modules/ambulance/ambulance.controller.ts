import { Request, Response } from "express";
import { z } from "zod";
import { ApiError } from "../../utils/ApiError";
import { User } from "../auth/user.model";
import { ACTIVE_TRIP_STATUSES, AmbulanceRequest, TripStatus } from "./ambulance.model";

const latLng = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

const requestSchema = z.object({
  type: z.enum(["emergency", "transfer"]).default("emergency"),
  pickupAddress: z.string().min(3),
  pickupLocation: latLng.optional(),
  dropAddress: z.string().optional(),
  condition: z.string().optional(),
  contactPhone: z.string().min(6),
  patientId: z.string().optional(), // when reception requests for a patient
});

const populate = [
  { path: "patient", select: "name phone" },
  { path: "driver", select: "name phone vehicleNumber vehicleType" },
];

// POST /api/ambulance  (patient or reception requests a trip)
export async function requestAmbulance(req: Request, res: Response) {
  const data = requestSchema.parse(req.body);
  const { id, role } = req.user!;
  const patientId = role === "patient" ? id : data.patientId;
  if (!patientId) throw new ApiError(400, "patientId is required when staff requests an ambulance");

  const existing = await AmbulanceRequest.findOne({ patient: patientId, status: { $in: ACTIVE_TRIP_STATUSES } });
  if (existing) throw new ApiError(409, "This patient already has an active ambulance request");

  const { patientId: _p, pickupLocation, ...rest } = data;
  const trip = await AmbulanceRequest.create({
    ...rest,
    patient: patientId,
    requestedBy: id,
    pickupLocation: pickupLocation ? { ...pickupLocation, updatedAt: new Date() } : undefined,
    timeline: [{ status: "requested" }],
  });
  res.status(201).json({ trip: await trip.populate(populate) });
}

// GET /api/ambulance/mine  (patient: active trip + history)
export async function myTrips(req: Request, res: Response) {
  const trips = await AmbulanceRequest.find({ patient: req.user!.id }).sort({ createdAt: -1 }).limit(20).populate(populate);
  const active = trips.find((t) => ACTIVE_TRIP_STATUSES.includes(t.status as TripStatus)) ?? null;
  res.json({ active, trips });
}

// GET /api/ambulance/open  (driver: unassigned requests, emergencies first)
export async function openRequests(_req: Request, res: Response) {
  const trips = await AmbulanceRequest.find({ status: "requested" }).sort({ type: 1, createdAt: 1 }).populate(populate);
  res.json({ trips });
}

// GET /api/ambulance/current  (driver: the trip they are on)
export async function currentTrip(req: Request, res: Response) {
  const trip = await AmbulanceRequest.findOne({
    driver: req.user!.id,
    status: { $in: ["accepted", "arrived", "on_board"] },
  }).populate(populate);
  res.json({ trip });
}

// GET /api/ambulance  (reception/admin: every active trip)
export async function allActive(_req: Request, res: Response) {
  const trips = await AmbulanceRequest.find({ status: { $in: ACTIVE_TRIP_STATUSES } }).sort({ createdAt: -1 }).populate(populate);
  res.json({ trips });
}

// PATCH /api/ambulance/:id/accept  (driver)
export async function acceptTrip(req: Request, res: Response) {
  const driverId = req.user!.id;
  const busy = await AmbulanceRequest.exists({ driver: driverId, status: { $in: ["accepted", "arrived", "on_board"] } });
  if (busy) throw new ApiError(409, "Finish your current trip first");

  // Atomic: only succeeds if nobody else accepted it first.
  const trip = await AmbulanceRequest.findOneAndUpdate(
    { _id: req.params.id, status: "requested" },
    { driver: driverId, status: "accepted", $push: { timeline: { status: "accepted", at: new Date() } } },
    { new: true }
  ).populate(populate);
  if (!trip) throw new ApiError(409, "This request was already taken or cancelled");

  await User.findByIdAndUpdate(driverId, { isAvailable: false });
  res.json({ trip });
}

// Order a driver must follow.
const nextStep: Partial<Record<TripStatus, TripStatus>> = {
  accepted: "arrived",
  arrived: "on_board",
  on_board: "completed",
};

// PATCH /api/ambulance/:id/status  { status }
export async function updateTripStatus(req: Request, res: Response) {
  const { status } = z.object({ status: z.enum(["arrived", "on_board", "completed", "cancelled"]) }).parse(req.body);
  const { id, role } = req.user!;
  const trip = await AmbulanceRequest.findById(req.params.id);
  if (!trip) throw new ApiError(404, "Trip not found");

  if (status === "cancelled") {
    const canCancel =
      (role === "patient" && trip.patient.toString() === id) || role === "receptionist" || role === "admin";
    if (!canCancel) throw new ApiError(403, "You cannot cancel this trip");
    if (!["requested", "accepted"].includes(trip.status)) throw new ApiError(400, "Trip can no longer be cancelled");
  } else {
    if (role !== "driver" || trip.driver?.toString() !== id) throw new ApiError(403, "Only the assigned driver can update this trip");
    if (nextStep[trip.status as TripStatus] !== status) {
      throw new ApiError(400, `Next step after ${trip.status} is ${nextStep[trip.status as TripStatus] ?? "none"}`);
    }
  }

  trip.status = status;
  trip.timeline.push({ status, at: new Date() });
  await trip.save();

  if ((status === "completed" || status === "cancelled") && trip.driver) {
    await User.findByIdAndUpdate(trip.driver, { isAvailable: true });
  }
  res.json({ trip: await trip.populate(populate) });
}

// PATCH /api/ambulance/location  (driver's phone sends GPS every few seconds while on duty)
// Updates the driver's position for the "nearby ambulances" map, and the active trip if there is one.
export async function updateLocation(req: Request, res: Response) {
  const point = latLng.parse(req.body);
  const now = new Date();
  await User.findByIdAndUpdate(req.user!.id, {
    location: { type: "Point", coordinates: [point.lng, point.lat] },
    locationUpdatedAt: now,
  });
  await AmbulanceRequest.updateOne(
    { driver: req.user!.id, status: { $in: ["accepted", "arrived", "on_board"] } },
    { driverLocation: { ...point, updatedAt: now } }
  );
  res.json({ ok: true });
}

// Straight-line distance in km (haversine formula).
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// GET /api/ambulance/nearby?lat=..&lng=..&radiusKm=15
// Available ambulances near the patient, nearest first (seen in the last 10 minutes).
export async function nearbyAmbulances(req: Request, res: Response) {
  const q = z
    .object({ lat: z.coerce.number(), lng: z.coerce.number(), radiusKm: z.coerce.number().max(50).default(15) })
    .parse(req.query);

  const drivers = await User.find({
    role: "driver",
    isAvailable: true,
    locationUpdatedAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) },
    location: {
      $near: {
        $geometry: { type: "Point", coordinates: [q.lng, q.lat] },
        $maxDistance: q.radiusKm * 1000, // metres
      },
    },
  })
    .select("name vehicleNumber vehicleType location")
    .limit(20);

  const ambulances = drivers.map((d) => {
    const [lng, lat] = d.location!.coordinates as number[];
    const km = distanceKm(q, { lat, lng });
    return {
      driverId: d.id,
      name: d.name,
      vehicleNumber: d.vehicleNumber,
      vehicleType: d.vehicleType,
      lat,
      lng,
      distanceKm: Math.round(km * 10) / 10,
      etaMin: Math.max(2, Math.round((km / 30) * 60)), // rough city speed of 30 km/h
    };
  });
  res.json({ ambulances });
}

// PATCH /api/ambulance/availability  (driver goes on/off duty)
export async function setAvailability(req: Request, res: Response) {
  const { isAvailable } = z.object({ isAvailable: z.boolean() }).parse(req.body);
  const user = await User.findByIdAndUpdate(req.user!.id, { isAvailable }, { new: true }).select("isAvailable");
  res.json({ isAvailable: user?.isAvailable });
}
