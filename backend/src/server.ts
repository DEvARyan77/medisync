import { app } from "./app";
import { env } from "./config/env";
import { connectDB } from "./config/db";
import { seedDemoUsers } from "./scripts/seed";
import { seedDemoData, startDemoAmbulances } from "./scripts/demoData";
import { closePastDays } from "./modules/appointments/appointment.model";
import { clinicToday } from "./utils/clinicTime";

async function start() {
  await connectDB();
  if (process.env.SEED_DEMO === "true") {
    await seedDemoUsers();
    // Demo data must never stop the API from starting.
    await seedDemoData().catch((e) => console.error("demo data failed:", e));
    await startDemoAmbulances().catch((e) => console.error("demo ambulances failed:", e));
  }
  // Yesterday's unfinished bookings become no-shows (and keep doing so while the server runs)
  const sweep = () => closePastDays(clinicToday()).then((n) => n && console.log(`appointments: ${n} past bookings marked no-show`)).catch(() => {});
  await sweep();
  setInterval(sweep, 10 * 60_000).unref();
  app.listen(env.port, () => console.log(`MediSync API running on http://localhost:${env.port}`));
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
