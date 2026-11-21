import { z } from "zod";

// Optional second email; "" clears it.
export const alternateEmail = z.string().trim().toLowerCase().email("Enter a valid alternate email").optional().or(z.literal(""));
const differentEmails = (d: { email: string; alternateEmail?: string }) => !d.alternateEmail || d.alternateEmail !== d.email.toLowerCase();
const differentMsg = { message: "Alternate email must be different from your main email", path: ["alternateEmail"] };

export const registerPatientSchema = z
  .object({
  name: z.string().min(2),
  email: z.string().email(),
  alternateEmail,
  password: z.string().min(6),
  phone: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  dateOfBirth: z.coerce.date().optional(),
  allergies: z.array(z.string()).optional(),
  otp: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from your email"),
})
  .refine(differentEmails, differentMsg);

export const createStaffSchema = z
  .object({
  name: z.string().min(2),
  email: z.string().email(),
  alternateEmail,
  password: z.string().min(6),
  role: z.enum(["doctor", "receptionist", "pharmacist", "driver", "admin"]),
  phone: z.string().optional(),
  department: z.string().optional(),
  specialization: z.string().optional(),
  vehicleNumber: z.string().optional(),
  vehicleType: z.enum(["basic", "advanced"]).optional(),
})
  .refine(differentEmails, differentMsg);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
