import { Schema, model } from "mongoose";

const consultationSchema = new Schema(
  {
    appointment: { type: Schema.Types.ObjectId, ref: "Appointment", required: true, unique: true },
    patient: { type: Schema.Types.ObjectId, ref: "User", required: true },
    doctor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    vitals: {
      bloodPressure: String, // "120/80"
      pulse: Number,
      temperatureF: Number,
      weightKg: Number,
    },
    chiefComplaint: { type: String, required: true },
    diagnosis: { type: String, required: true },
    notes: { type: String },
    prescription: { type: Schema.Types.ObjectId, ref: "Prescription" },
  },
  { timestamps: true }
);

export const Consultation = model("Consultation", consultationSchema);
