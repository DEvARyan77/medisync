import { Schema, model, InferSchemaType } from "mongoose";
import bcrypt from "bcryptjs";

export const ROLES = ["patient", "doctor", "receptionist", "pharmacist", "driver", "admin"] as const;
export type Role = (typeof ROLES)[number];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: "patient" },
    phone: { type: String },

    // Patient-only fields
    gender: { type: String, enum: ["male", "female", "other"] },
    dateOfBirth: { type: Date },
    allergies: { type: [String], default: [] },
    bloodGroup: { type: String, enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] },
    address: { type: String, trim: true },
    emergencyContact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      relation: { type: String, trim: true },
    },

    // Forgot-password: only a hash of the emailed token is stored.
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },

    // Doctor-only fields
    department: { type: String },
    specialization: { type: String },

    // Ambulance driver-only fields
    vehicleNumber: { type: String },
    vehicleType: { type: String, enum: ["basic", "advanced"] }, // BLS / ALS ambulance
    isAvailable: { type: Boolean, default: true },
    // GeoJSON point so MongoDB can find "nearest ambulances" with $near.
    location: {
      type: { type: String, enum: ["Point"] },
      // [lng, lat] (longitude first!). default undefined so non-drivers get no empty
      // array, which would break the 2dsphere index.
      coordinates: { type: [Number], default: undefined },
    },
    locationUpdatedAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.index({ location: "2dsphere" }, { sparse: true });

// Hash the password whenever it is set or changed.
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

export type UserDoc = InferSchemaType<typeof userSchema> & {
  comparePassword(candidate: string): Promise<boolean>;
};

export const User = model("User", userSchema);
