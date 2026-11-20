import { app } from "./app";
import { env } from "./config/env";
import { connectDB } from "./config/db";
import { seedDemoUsers } from "./scripts/seed";
import { seedDemoData, startDemoAmbulances } from "./scripts/demoData";

async function start() {
  await connectDB();
  if (process.env.SEED_DEMO === "true") {
    await seedDemoUsers();
    // Demo data must never stop the API from starting.
    await seedDemoData().catch((e) => console.error("demo data failed:", e));
    await startDemoAmbulances().catch((e) => console.error("demo ambulances failed:", e));
  }
  app.listen(env.port, () => console.log(`MediSync API running on http://localhost:${env.port}`));
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
