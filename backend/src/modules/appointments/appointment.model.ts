import { Schema, model } from "mongoose";

export const APPOINTMENT_STATUSES = [
  "booked",
  "checked_in",
  "in_consultation",
  "completed",
  "cancelled",
  "no_show",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

// Statuses that still hold a slot (used for the double-booking guard).
export const ACTIVE_STATUSES: AppointmentStatus[] = ["booked", "checked_in", "in_consultation", "completed"];

// OPD slots: 09:00 to 13:00 every 30 minutes. Change to suit the clinic.
export const OPD_SLOTS = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30"];

const appointmentSchema = new Schema(
  {
    patient: { type: Schema.Types.ObjectId, ref: "User", required: true },
    doctor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true }, // "YYYY-MM-DD", keeps day-based queries simple
    slot: { type: String, required: true, enum: OPD_SLOTS },
    reason: { type: String },
    status: { type: String, enum: APPOINTMENT_STATUSES, default: "booked" },
    token: { type: String }, // e.g. "A-14", given at check-in
    tokenNumber: { type: Number }, // numeric part, for sorting the queue
    checkedInAt: { type: Date },
  },
  { timestamps: true }
);

// One active appointment per doctor per slot.
appointmentSchema.index(
  { doctor: 1, date: 1, slot: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ACTIVE_STATUSES } } }
);

export const Appointment = model("Appointment", appointmentSchema);

// Daily token counter: { _id: "2026-11-20", seq: 14 }
const counterSchema = new Schema({ _id: { type: String, required: true }, seq: { type: Number, default: 0 } });
export const Counter = model("Counter", counterSchema);

export async function nextToken(date: string): Promise<{ token: string; tokenNumber: number }> {
  // $inc is atomic, so two receptionists checking in at once never get the same token.
  const counter = await Counter.findOneAndUpdate({ _id: date }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return { token: `A-${counter.seq}`, tokenNumber: counter.seq };
}

/**
 * Appointments from earlier days that never finished: a "booked" patient who never came, or a
 * checked-in patient who left without being seen, become no-shows. Runs on start-up, every few
 * minutes, and before lists are read, so yesterday's bookings never show as "waiting".
 */
export async function closePastDays(today: string): Promise<number> {
  const result = await Appointment.updateMany(
    { date: { $lt: today }, status: { $in: ["booked", "checked_in"] } },
    { $set: { status: "no_show" } }
  );
  // A consultation left open yesterday is treated as finished
  await Appointment.updateMany({ date: { $lt: today }, status: "in_consultation" }, { $set: { status: "completed" } });
  return result.modifiedCount;
}
