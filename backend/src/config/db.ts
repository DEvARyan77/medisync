import mongoose from "mongoose";
import { env } from "./env";

export async function connectDB(): Promise<void> {
  // dbName keeps MediSync in its own database even if the URI has none
  // (otherwise MongoDB would fall back to the shared "test" database).
  await mongoose.connect(env.mongoUri, { dbName: env.mongoDbName });
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}
