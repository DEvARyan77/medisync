import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { emailEnabled } from "./services/email";
import { errorHandler, notFound } from "./middleware/errorHandler";
import authRoutes from "./modules/auth/auth.routes";
import userRoutes from "./modules/users/users.routes";
import appointmentRoutes from "./modules/appointments/appointment.routes";
import consultationRoutes from "./modules/consultations/consultation.routes";
import prescriptionRoutes from "./modules/prescriptions/prescription.routes";
import ambulanceRoutes from "./modules/ambulance/ambulance.routes";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.clientUrl.split(","), credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "medisync-api", email: emailEnabled() ? "brevo" : "off" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/consultations", consultationRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/ambulance", ambulanceRoutes);

app.use(notFound);
app.use(errorHandler);
