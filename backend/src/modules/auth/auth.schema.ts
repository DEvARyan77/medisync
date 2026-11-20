import { z } from "zod";

export const registerPatientSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  dateOfBirth: z.coerce.date().optional(),
  allergies: z.array(z.string()).optional(),
});

export const createStaffSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["doctor", "receptionist", "pharmacist", "driver", "admin"]),
  phone: z.string().optional(),
  department: z.string().optional(),
  specialization: z.string().optional(),
  vehicleNumber: z.string().optional(),
  vehicleType: z.enum(["basic", "advanced"]).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
