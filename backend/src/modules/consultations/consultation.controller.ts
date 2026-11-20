import { Request, Response } from "express";
import { z } from "zod";
import { ApiError } from "../../utils/ApiError";
import { Appointment } from "../appointments/appointment.model";
import { Prescription } from "../prescriptions/prescription.model";
import { Consultation } from "./consultation.model";
import { User } from "../auth/user.model";
import { sendEmail } from "../../services/email";
import { prescriptionEmail } from "../../services/emailTemplates";

const createSchema = z.object({
  appointmentId: z.string(),
  vitals: z
    .object({
      bloodPressure: z.string().optional(),
      pulse: z.coerce.number().optional(),
      temperatureF: z.coerce.number().optional(),
      weightKg: z.coerce.number().optional(),
    })
    .optional(),
  chiefComplaint: z.string().min(1),
  diagnosis: z.string().min(1),
  notes: z.string().optional(),
  medicines: z
    .array(
      z.object({
        medicine: z.string().min(1),
        dose: z.string().min(1),
        frequency: z.string().min(1),
        days: z.coerce.number().int().positive(),
        instructions: z.string().optional(),
      })
    )
    .default([]),
});

// POST /api/consultations  (doctor finishes a visit)
export async function createConsultation(req: Request, res: Response) {
  const data = createSchema.parse(req.body);
  const doctorId = req.user!.id;

  const appointment = await Appointment.findById(data.appointmentId);
  if (!appointment) throw new ApiError(404, "Appointment not found");
  if (appointment.doctor.toString() !== doctorId) throw new ApiError(403, "Not your patient");
  if (!["checked_in", "in_consultation"].includes(appointment.status)) {
    throw new ApiError(400, `Cannot consult an appointment that is ${appointment.status}`);
  }

  const consultation = await Consultation.create({
    appointment: appointment._id,
    patient: appointment.patient,
    doctor: doctorId,
    vitals: data.vitals,
    chiefComplaint: data.chiefComplaint,
    diagnosis: data.diagnosis,
    notes: data.notes,
  });

  if (data.medicines.length > 0) {
    const prescription = await Prescription.create({
      patient: appointment.patient,
      doctor: doctorId,
      consultation: consultation._id,
      items: data.medicines,
    });
    consultation.prescription = prescription._id;
    await consultation.save();
  }

  appointment.status = "completed";
  await appointment.save();

  const [patient, doctor] = await Promise.all([
    User.findById(appointment.patient).select("name email alternateEmail"),
    User.findById(doctorId).select("name"),
  ]);
  if (patient) {
    sendEmail({
      to: patient.email,
      cc: patient.alternateEmail,
      name: patient.name,
      ...prescriptionEmail({ name: patient.name, doctor: doctor?.name ?? "Your doctor", diagnosis: data.diagnosis, medicines: data.medicines }),
    });
  }

  res.status(201).json({ consultation: await consultation.populate("prescription") });
}

// GET /api/consultations/patient/:patientId  (visit history)
export async function patientHistory(req: Request, res: Response) {
  const { role, id } = req.user!;
  const { patientId } = req.params;
  if (role === "patient" && patientId !== id) throw new ApiError(403, "You can only see your own history");

  const consultations = await Consultation.find({ patient: patientId })
    .sort({ createdAt: -1 })
    .populate("doctor", "name department")
    .populate("prescription");
  res.json({ consultations });
}
