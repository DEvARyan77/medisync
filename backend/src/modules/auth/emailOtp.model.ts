import { Schema, model } from "mongoose";

// A sign-up code emailed before the account is created. Deleted automatically when it expires.
const emailOtpSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    codeHash: { type: String, required: true }, // sha256 of the 6-digit code, never the code itself
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 }, // wrong guesses for this code
    lastSentAt: { type: Date, required: true },
    // Sends in the current hour, to stop someone flooding an inbox with codes
    windowStart: { type: Date, required: true },
    sendsInWindow: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// MongoDB removes the document an hour after the code expires (keeps the hourly limit working meanwhile)
emailOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

export const EmailOtp = model("EmailOtp", emailOtpSchema);
