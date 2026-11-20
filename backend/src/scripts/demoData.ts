// Realistic demo data so every portal has something to show.
// Runs on startup when SEED_DEMO=true, after the demo users exist. Safe to run repeatedly:
//  - visit history and patients are created once
//  - today's OPD queue is created once per day (so a fresh demo appears every morning)
//  - demo ambulances keep sharing a (simulated) GPS position while the server is awake
import { Types } from "mongoose";
import { User } from "../modules/auth/user.model";
import { ACTIVE_STATUSES, Appointment, AppointmentStatus, Counter } from "../modules/appointments/appointment.model";
import { Consultation } from "../modules/consultations/consultation.model";
import { Prescription } from "../modules/prescriptions/prescription.model";
import { addDays, clinicDateTime, clinicNow } from "../utils/clinicTime";

type Id = Types.ObjectId;

const demoPatients = [
  { name: "Priya Sharma", email: "priya@medisync.dev", phone: "9810011223", gender: "female", dateOfBirth: new Date("1988-07-21"), allergies: [] },
  { name: "Rahul Verma", email: "rahul@medisync.dev", phone: "9810022334", gender: "male", dateOfBirth: new Date("1975-02-03"), allergies: ["Sulfa drugs"] },
  { name: "Sneha Gupta", email: "sneha@medisync.dev", phone: "9810033445", gender: "female", dateOfBirth: new Date("1996-11-09"), allergies: [] },
  { name: "Mohit Singh", email: "mohit@medisync.dev", phone: "9810044556", gender: "male", dateOfBirth: new Date("1964-05-30"), allergies: ["Aspirin"] },
  { name: "Kavya Iyer", email: "kavya@medisync.dev", phone: "9810055667", gender: "female", dateOfBirth: new Date("2001-01-17"), allergies: [] },
  { name: "Arvind Nair", email: "arvind@medisync.dev", phone: "9810066778", gender: "male", dateOfBirth: new Date("1958-09-12"), allergies: ["Penicillin"] },
];

// Common OPD cases: complaint, diagnosis, medicines.
const cases = [
  {
    complaint: "Fever and body ache for 3 days",
    diagnosis: "Viral fever",
    meds: [
      { medicine: "Paracetamol", dose: "650 mg", frequency: "1-1-1", days: 3, instructions: "after food, if fever" },
      { medicine: "Cetirizine", dose: "10 mg", frequency: "0-0-1", days: 5 },
    ],
  },
  {
    complaint: "Headache and dizziness, BP high at home",
    diagnosis: "Essential hypertension",
    meds: [{ medicine: "Amlodipine", dose: "5 mg", frequency: "1-0-0", days: 30, instructions: "same time daily" }],
  },
  {
    complaint: "Increased thirst and frequent urination",
    diagnosis: "Type 2 diabetes mellitus",
    meds: [{ medicine: "Metformin", dose: "500 mg", frequency: "1-0-1", days: 30, instructions: "after meals" }],
  },
  {
    complaint: "Burning sensation in chest after meals",
    diagnosis: "Acid reflux (GERD)",
    meds: [{ medicine: "Pantoprazole", dose: "40 mg", frequency: "1-0-0", days: 14, instructions: "before breakfast" }],
  },
  {
    complaint: "Knee pain while climbing stairs",
    diagnosis: "Osteoarthritis of knee",
    meds: [
      { medicine: "Aceclofenac", dose: "100 mg", frequency: "1-0-1", days: 5, instructions: "after food" },
      { medicine: "Calcium + Vitamin D3", dose: "500 mg", frequency: "0-1-0", days: 30 },
    ],
  },
  {
    complaint: "Chest discomfort on exertion",
    diagnosis: "Stable angina, for evaluation",
    meds: [
      { medicine: "Atorvastatin", dose: "20 mg", frequency: "0-0-1", days: 30 },
      { medicine: "Sorbitrate", dose: "5 mg", frequency: "SOS", days: 30, instructions: "under the tongue for chest pain" },
    ],
  },
  {
    complaint: "Sore throat and cough",
    diagnosis: "Acute pharyngitis",
    meds: [
      { medicine: "Azithromycin", dose: "500 mg", frequency: "1-0-0", days: 3 },
      { medicine: "Warm saline gargles", dose: "-", frequency: "3 times", days: 5 },
    ],
  },
];

const vitalsFor = (i: number) => ({
  bloodPressure: ["118/76", "146/94", "128/82", "122/80", "134/86", "150/96", "116/74"][i % 7],
  pulse: [78, 88, 82, 74, 80, 92, 84][i % 7],
  temperatureF: [101.2, 98.4, 98.6, 98.2, 98.6, 98.4, 99.8][i % 7],
  weightKg: [62, 81, 74, 68, 77, 85, 59][i % 7],
});

// Saves a document with backdated createdAt/updatedAt.
async function createAt<T extends { save(o: object): Promise<unknown> }>(doc: T, at: Date) {
  Object.assign(doc, { createdAt: at, updatedAt: at });
  await doc.save({ timestamps: false });
  return doc;
}

async function addVisit(opts: {
  patient: Id;
  doctor: Id;
  appointment: Id;
  caseIndex: number;
  at: Date;
  dispensed: boolean;
}) {
  const c = cases[opts.caseIndex % cases.length];
  const consultation = await createAt(
    new Consultation({
      appointment: opts.appointment,
      patient: opts.patient,
      doctor: opts.doctor,
      vitals: vitalsFor(opts.caseIndex),
      chiefComplaint: c.complaint,
      diagnosis: c.diagnosis,
    }),
    opts.at
  );
  const prescription = await createAt(
    new Prescription({
      patient: opts.patient,
      doctor: opts.doctor,
      consultation: consultation._id,
      items: c.meds,
      status: opts.dispensed ? "dispensed" : "pending",
      dispensedAt: opts.dispensed ? new Date(opts.at.getTime() + 20 * 60 * 1000) : undefined,
    }),
    opts.at
  );
  consultation.prescription = prescription._id;
  await consultation.save({ timestamps: false });
}

export async function seedDemoData(): Promise<void> {
  // 1. Extra patients
  for (const p of demoPatients) {
    if (!(await User.exists({ email: p.email }))) await User.create({ ...p, role: "patient", password: "password123" });
  }

  const byEmail = async (email: string) => (await User.findOne({ email }).select("_id"))!._id as Id;
  const arjun = await byEmail("arjun@medisync.dev");
  const neha = await byEmail("neha@medisync.dev");
  const vikram = await byEmail("vikram@medisync.dev");
  const aman = await byEmail("patient@medisync.dev");
  const [priya, rahul, sneha, mohit, kavya, arvind] = await Promise.all(demoPatients.map((p) => byEmail(p.email)));
  const now = clinicNow();

  // 2. Past visit history (once): fills health timelines and the pharmacy's "dispensed" list
  if (!(await Consultation.exists({}))) {
    const history: [Id, Id, number, number, string][] = [
      // patient, doctor, case, days ago, slot
      [aman, arjun, 0, 60, "10:00"],
      [aman, neha, 1, 21, "11:30"],
      [rahul, arjun, 2, 45, "09:30"],
      [rahul, arjun, 2, 14, "10:30"],
      [mohit, neha, 5, 30, "12:00"],
      [mohit, vikram, 4, 9, "09:00"],
      [arvind, neha, 1, 18, "11:00"],
      [priya, arjun, 6, 7, "10:00"],
    ];
    for (const [patient, doctor, caseIndex, daysAgo, slot] of history) {
      const date = addDays(now.date, -daysAgo);
      const appt = await Appointment.create({ patient, doctor, date, slot, status: "completed", reason: cases[caseIndex].complaint });
      await addVisit({ patient, doctor, appointment: appt._id, caseIndex, at: clinicDateTime(date, slot), dispensed: true });
    }
    console.log("demo: visit history added");
  }

  // 3. Today's OPD queue (once per day). A marker document records that today's demo
  // queue exists, so real bookings made earlier in the day don't stop it from being added.
  const marker = `demo-queue-${now.date}`;
  if (!(await Counter.exists({ _id: marker }))) {
    await Counter.create({ _id: marker, seq: 1 });
    const today: [Id, Id, string, AppointmentStatus, number][] = [
      // patient, doctor, slot, status, case
      [priya, arjun, "09:00", "completed", 0],
      [rahul, arjun, "09:30", "completed", 2],
      [sneha, neha, "09:30", "completed", 3],
      [mohit, vikram, "10:00", "completed", 4],
      [kavya, arjun, "10:00", "in_consultation", 6],
      [arvind, neha, "10:30", "checked_in", 1],
      [aman, arjun, "10:30", "checked_in", 0],
      [sneha, arjun, "11:00", "checked_in", 3],
      [priya, vikram, "11:00", "no_show", 4],
      [rahul, neha, "12:00", "booked", 5],
      [mohit, arjun, "12:30", "booked", 1],
    ];
    // Continue after any tokens real check-ins already used today.
    let token = (await Counter.findById(now.date))?.seq ?? 0;
    let dispensedSoFar = 0;
    for (const [patient, doctor, slot, status, caseIndex] of today) {
      // Skip a slot that someone has really booked.
      if (await Appointment.exists({ doctor, date: now.date, slot, status: { $in: ACTIVE_STATUSES } })) continue;
      const checkedIn = ["checked_in", "in_consultation", "completed"].includes(status);
      if (checkedIn) token += 1;
      const appt = await Appointment.create({
        patient,
        doctor,
        date: now.date,
        slot,
        status,
        reason: cases[caseIndex].complaint,
        ...(checkedIn && { token: `A-${token}`, tokenNumber: token, checkedInAt: clinicDateTime(now.date, slot) }),
      });
      // Finished visits get a prescription waiting at the pharmacy (two already handed over).
      if (status === "completed") {
        await addVisit({ patient, doctor, appointment: appt._id, caseIndex, at: clinicDateTime(now.date, slot), dispensed: dispensedSoFar++ < 2 });
      }
    }
    // Next walk-in gets the next token number.
    await Counter.findOneAndUpdate({ _id: now.date }, { seq: token }, { upsert: true });

    // A few bookings for tomorrow
    const tomorrow = addDays(now.date, 1);
    const upcoming: [Id, Id, string][] = [
      [aman, neha, "10:00"],
      [kavya, neha, "09:00"],
      [arvind, arjun, "11:30"],
      [sneha, vikram, "09:30"],
    ];
    for (const [patient, doctor, slot] of upcoming) {
      const exists = await Appointment.exists({ doctor, date: tomorrow, slot, status: { $ne: "cancelled" } });
      if (!exists) await Appointment.create({ patient, doctor, date: tomorrow, slot, reason: "Follow-up" });
    }
    console.log(`demo: OPD queue added for ${now.date}`);
  }
}

// Demo ambulances around Delhi. Their GPS is refreshed every few minutes while the server
// is awake, so they appear under "Ambulances near you" for patients in Delhi NCR.
const demoAmbulances = [
  { email: "driver@medisync.dev", lat: 28.7499, lng: 77.117 }, // Rohini / DTU
  { email: "driver2@medisync.dev", lat: 28.6315, lng: 77.2167 }, // Connaught Place
  { email: "driver3@medisync.dev", lat: 28.5672, lng: 77.21 }, // AIIMS
];

export async function startDemoAmbulances(): Promise<void> {
  if (!(await User.exists({ email: "driver3@medisync.dev" }))) {
    await User.create({
      name: "Imran Driver",
      email: "driver3@medisync.dev",
      password: "password123",
      role: "driver",
      phone: "9000000003",
      vehicleNumber: "DL 3C 9012",
      vehicleType: "advanced",
    });
  }

  const tick = async () => {
    for (const a of demoAmbulances) {
      // Small random drift so the ambulances look like they are moving.
      const lat = a.lat + (Math.random() - 0.5) * 0.01;
      const lng = a.lng + (Math.random() - 0.5) * 0.01;
      // Only touch demo drivers who are not on a real trip (a real driver's phone sends real GPS).
      await User.updateOne(
        { email: a.email, isAvailable: true },
        { location: { type: "Point", coordinates: [lng, lat] }, locationUpdatedAt: new Date() }
      );
    }
  };
  await tick();
  setInterval(() => tick().catch((e) => console.error("demo ambulance tick failed", e)), 3 * 60 * 1000).unref();
}
