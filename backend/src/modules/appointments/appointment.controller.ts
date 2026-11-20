import { Request, Response } from "express";
import { z } from "zod";
import { ApiError } from "../../utils/ApiError";
import { addDays, clinicNow, isPastSlot } from "../../utils/clinicTime";
import { User } from "../auth/user.model";
import { ACTIVE_STATUSES, Appointment, AppointmentStatus, OPD_SLOTS, nextToken } from "./appointment.model";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const bookSchema = z.object({
  doctorId: z.string(),
  date: dateString,
  slot: z.enum(OPD_SLOTS as [string, ...string[]]),
  reason: z.string().optional(),
  patientId: z.string().optional(), // only used when reception books for a patient
});

const statusSchema = z.object({
  status: z.enum(["checked_in", "in_consultation", "cancelled", "no_show"]),
});

// Patients can book from now up to this many days ahead.
const MAX_DAYS_AHEAD = 30;

const today = () => clinicNow().date;

const populate = [
  { path: "patient", select: "name phone gender dateOfBirth allergies" },
  { path: "doctor", select: "name department specialization" },
];

// GET /api/appointments/slots?doctorId=...&date=YYYY-MM-DD
export async function getAvailableSlots(req: Request, res: Response) {
  const { doctorId, date } = z.object({ doctorId: z.string(), date: dateString }).parse(req.query);
  const now = clinicNow();
  const taken = await Appointment.find({ doctor: doctorId, date, status: { $in: ACTIVE_STATUSES } }).select("slot");
  const takenSet = new Set(taken.map((a) => a.slot));
  const tooFar = date > addDays(now.date, MAX_DAYS_AHEAD);

  // reason tells the UI why a slot is greyed out: "past", "booked" or "too_far".
  const slots = OPD_SLOTS.map((slot) => {
    const reason = isPastSlot(date, slot, now) ? "past" : tooFar ? "too_far" : takenSet.has(slot) ? "booked" : null;
    return { slot, available: reason === null, reason };
  });
  res.json({ date, today: now.date, maxDate: addDays(now.date, MAX_DAYS_AHEAD), slots });
}

// POST /api/appointments
export async function bookAppointment(req: Request, res: Response) {
  const data = bookSchema.parse(req.body);
  const isPatient = req.user!.role === "patient";
  const patientId = isPatient ? req.user!.id : data.patientId;
  if (!patientId) throw new ApiError(400, "patientId is required when staff books an appointment");
  // Checked on the server too, so nobody can book a past slot by calling the API directly.
  const now = clinicNow();
  if (isPastSlot(data.date, data.slot, now)) throw new ApiError(400, "This time slot has already passed");
  if (data.date > addDays(now.date, MAX_DAYS_AHEAD)) {
    throw new ApiError(400, `Appointments can be booked up to ${MAX_DAYS_AHEAD} days ahead`);
  }

  const doctor = await User.findOne({ _id: data.doctorId, role: "doctor" });
  if (!doctor) throw new ApiError(404, "Doctor not found");

  const clash = await Appointment.findOne({
    doctor: data.doctorId,
    date: data.date,
    slot: data.slot,
    status: { $in: ACTIVE_STATUSES },
  });
  if (clash) throw new ApiError(409, "This slot is already booked");

  const appointment = await Appointment.create({
    patient: patientId,
    doctor: data.doctorId,
    date: data.date,
    slot: data.slot,
    reason: data.reason,
  });
  res.status(201).json({ appointment: await appointment.populate(populate) });
}

// GET /api/appointments/mine  (patient's own appointments)
export async function myAppointments(req: Request, res: Response) {
  const appointments = await Appointment.find({ patient: req.user!.id })
    .sort({ date: -1, slot: 1 })
    .populate(populate);
  res.json({ appointments });
}

// GET /api/appointments/queue?date=YYYY-MM-DD  (reception sees all, a doctor sees their own)
export async function getQueue(req: Request, res: Response) {
  const date = req.query.date ? dateString.parse(req.query.date) : today();
  const filter: Record<string, unknown> = { date };
  if (req.user!.role === "doctor") filter.doctor = req.user!.id;

  const appointments = await Appointment.find(filter).sort({ tokenNumber: 1, slot: 1 }).populate(populate);

  const count = (s: AppointmentStatus) => appointments.filter((a) => a.status === s).length;
  res.json({
    date,
    stats: {
      waiting: count("checked_in"),
      inConsultation: count("in_consultation"),
      completed: count("completed"),
      noShow: count("no_show"),
      booked: count("booked"),
    },
    appointments,
  });
}

// Who may move an appointment from one status to another.
const allowedMoves: Record<string, { from: AppointmentStatus[]; roles: string[] }> = {
  checked_in: { from: ["booked"], roles: ["receptionist", "admin"] },
  in_consultation: { from: ["checked_in"], roles: ["receptionist", "doctor", "admin"] },
  no_show: { from: ["booked"], roles: ["receptionist", "admin"] },
  cancelled: { from: ["booked", "checked_in"], roles: ["patient", "receptionist", "admin"] },
};

// PATCH /api/appointments/:id/status
export async function updateStatus(req: Request, res: Response) {
  const { status } = statusSchema.parse(req.body);
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) throw new ApiError(404, "Appointment not found");

  const rule = allowedMoves[status];
  const { role, id } = req.user!;
  if (!rule.roles.includes(role)) throw new ApiError(403, `A ${role} cannot set status to ${status}`);
  if (!rule.from.includes(appointment.status as AppointmentStatus)) {
    throw new ApiError(400, `Cannot change status from ${appointment.status} to ${status}`);
  }
  if (role === "patient" && appointment.patient.toString() !== id) throw new ApiError(403, "Not your appointment");
  if (role === "doctor" && appointment.doctor.toString() !== id) throw new ApiError(403, "Not your patient");

  if (status === "checked_in") {
    Object.assign(appointment, await nextToken(appointment.date));
    appointment.checkedInAt = new Date();
  }
  appointment.status = status;
  await appointment.save();
  res.json({ appointment: await appointment.populate(populate) });
}
