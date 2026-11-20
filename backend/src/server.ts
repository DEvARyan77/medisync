import { app } from "./app";
import { env } from "./config/env";
import { connectDB } from "./config/db";
import { seedDemoUsers } from "./scripts/seed";

async function start() {
  await connectDB();
  if (process.env.SEED_DEMO === "true") await seedDemoUsers();
  app.listen(env.port, () => console.log(`MediSync API running on http://localhost:${env.port}`));
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
