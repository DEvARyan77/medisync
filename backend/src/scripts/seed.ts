// Creates demo users for every role. Run: npm run seed
// All demo passwords are "password123".
import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { User } from "../modules/auth/user.model";

const users = [
  { name: "Admin", email: "admin@medisync.dev", role: "admin" },
  { name: "Riya Reception", email: "reception@medisync.dev", role: "receptionist" },
  { name: "Dr. Arjun Mehta", email: "arjun@medisync.dev", role: "doctor", department: "General Medicine", specialization: "Internal Medicine" },
  { name: "Dr. Neha Kapoor", email: "neha@medisync.dev", role: "doctor", department: "Cardiology", specialization: "Cardiologist" },
  { name: "Dr. Vikram Rao", email: "vikram@medisync.dev", role: "doctor", department: "Orthopaedics", specialization: "Orthopaedic Surgeon" },
  { name: "Pooja Pharmacist", email: "pharmacy@medisync.dev", role: "pharmacist" },
  { name: "Ramesh Driver", email: "driver@medisync.dev", role: "driver", phone: "9000000001", vehicleNumber: "DL 1A 1234", vehicleType: "advanced" },
  { name: "Sanjay Driver", email: "driver2@medisync.dev", role: "driver", phone: "9000000002", vehicleNumber: "DL 2B 5678", vehicleType: "basic" },
  { name: "Aman Patient", email: "patient@medisync.dev", role: "patient", phone: "9876543210", gender: "male", dateOfBirth: new Date("1992-04-12"), allergies: ["Penicillin"] },
];

async function seed() {
  await connectDB();
  for (const u of users) {
    const exists = await User.findOne({ email: u.email });
    if (exists) {
      console.log(`skip   ${u.email}`);
      continue;
    }
    await User.create({ ...u, password: "password123" }); // create() runs the hashing hook
    console.log(`added  ${u.email} (${u.role})`);
  }
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
