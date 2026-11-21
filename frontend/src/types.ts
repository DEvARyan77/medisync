export type Role = "patient" | "doctor" | "receptionist" | "pharmacist" | "driver" | "admin";

export interface User {
  _id: string;
  name: string;
  email: string;
  alternateEmail?: string;
  role: Role;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  allergies?: string[];
  bloodGroup?: string;
  address?: string;
  emergencyContact?: { name?: string; phone?: string; relation?: string };
  department?: string;
  specialization?: string;
  vehicleNumber?: string;
  vehicleType?: string;
  isAvailable?: boolean;
  hasPassword?: boolean;
  authProviders?: { provider: "google" | "facebook" }[];
}

export type AppointmentStatus = "booked" | "checked_in" | "in_consultation" | "completed" | "cancelled" | "no_show";

export interface Appointment {
  _id: string;
  patient: User;
  doctor: User;
  date: string;
  slot: string;
  reason?: string;
  status: AppointmentStatus;
  token?: string;
  tokenNumber?: number;
}

export interface Medicine {
  medicine: string;
  dose: string;
  frequency: string;
  days: number;
  instructions?: string;
}

export interface Prescription {
  _id: string;
  patient: User;
  doctor: User;
  items: Medicine[];
  status: "pending" | "dispensed";
  createdAt: string;
}

export interface Consultation {
  _id: string;
  doctor: User;
  chiefComplaint: string;
  diagnosis: string;
  notes?: string;
  vitals?: { bloodPressure?: string; pulse?: number; temperatureF?: number; weightKg?: number };
  prescription?: Prescription;
  createdAt: string;
}

export type TripStatus = "requested" | "accepted" | "arrived" | "on_board" | "completed" | "cancelled";

export interface Trip {
  _id: string;
  patient: User;
  driver?: User;
  type: "emergency" | "transfer";
  pickupAddress: string;
  pickupLocation?: { lat: number; lng: number };
  dropAddress: string;
  condition?: string;
  contactPhone: string;
  status: TripStatus;
  driverLocation?: { lat: number; lng: number; updatedAt: string };
  timeline: { status: TripStatus; at: string }[];
  createdAt: string;
}
