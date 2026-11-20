// Creates demo users for every role. All demo passwords are "password123".
// Run once with `npm run seed`, or set SEED_DEMO=true so the server does it on startup
// (useful on hosts without a shell, such as Render's free plan).
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

// Adds any demo user that does not exist yet. Safe to run on every start.
export async function seedDemoUsers(): Promise<void> {
  for (const u of users) {
    if (await User.exists({ email: u.email })) continue;
    await User.create({ ...u, password: "password123" }); // create() runs the hashing hook
    console.log(`seeded ${u.email} (${u.role})`);
  }
}

// Only runs when called directly: `npm run seed`
if (require.main === module) {
  connectDB()
    .then(seedDemoUsers)
    .then(() => mongoose.disconnect())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
