import { Schema, model } from "mongoose";

export const TRIP_STATUSES = ["requested", "accepted", "arrived", "on_board", "completed", "cancelled"] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];
export const ACTIVE_TRIP_STATUSES: TripStatus[] = ["requested", "accepted", "arrived", "on_board"];

const pointSchema = new Schema(
  { lat: Number, lng: Number, updatedAt: Date },
  { _id: false }
);

const ambulanceRequestSchema = new Schema(
  {
    patient: { type: Schema.Types.ObjectId, ref: "User", required: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true }, // patient or receptionist
    driver: { type: Schema.Types.ObjectId, ref: "User" },
    type: { type: String, enum: ["emergency", "transfer"], default: "emergency" },
    pickupAddress: { type: String, required: true },
    pickupLocation: pointSchema, // from the browser's "Use my location"
    dropAddress: { type: String, default: "MediSync Hospital ER" },
    condition: { type: String },
    contactPhone: { type: String, required: true },
    status: { type: String, enum: TRIP_STATUSES, default: "requested" },
    driverLocation: pointSchema, // driver's last known GPS position
    timeline: [{ status: { type: String, enum: TRIP_STATUSES }, at: { type: Date, default: Date.now }, _id: false }],
  },
  { timestamps: true }
);

export const AmbulanceRequest = model("AmbulanceRequest", ambulanceRequestSchema);
