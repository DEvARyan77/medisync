import { Schema, model } from "mongoose";

const itemSchema = new Schema(
  {
    medicine: { type: String, required: true },
    dose: { type: String, required: true }, // "500 mg"
    frequency: { type: String, required: true }, // "1-0-1"
    days: { type: Number, required: true },
    instructions: { type: String }, // "after food"
  },
  { _id: false }
);

const prescriptionSchema = new Schema(
  {
    patient: { type: Schema.Types.ObjectId, ref: "User", required: true },
    doctor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    consultation: { type: Schema.Types.ObjectId, ref: "Consultation" },
    items: { type: [itemSchema], validate: (v: unknown[]) => v.length > 0 },
    status: { type: String, enum: ["pending", "dispensed"], default: "pending" },
    dispensedBy: { type: Schema.Types.ObjectId, ref: "User" },
    dispensedAt: { type: Date },
  },
  { timestamps: true }
);

export const Prescription = model("Prescription", prescriptionSchema);
