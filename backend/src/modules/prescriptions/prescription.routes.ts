import { Router, Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authorize, protect } from "../../middleware/auth";
import { ApiError } from "../../utils/ApiError";
import { Prescription } from "./prescription.model";
import { sendEmail } from "../../services/email";
import { dispensedEmail } from "../../services/emailTemplates";

const router = Router();
router.use(protect);

const populate = [
  { path: "patient", select: "name email alternateEmail phone allergies" },
  { path: "doctor", select: "name department" },
];

// GET /api/prescriptions?status=pending
// pharmacist/admin: all, doctor: ones they wrote, patient: their own
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { role, id } = req.user!;
    const filter: Record<string, unknown> = {};
    if (role === "patient") filter.patient = id;
    else if (role === "doctor") filter.doctor = id;
    else if (!["pharmacist", "admin"].includes(role)) throw new ApiError(403, "No access");
    if (req.query.status === "pending" || req.query.status === "dispensed") filter.status = req.query.status;

    const prescriptions = await Prescription.find(filter).sort({ createdAt: -1 }).limit(50).populate(populate);
    res.json({ prescriptions });
  })
);

// PATCH /api/prescriptions/:id/dispense  (pharmacist hands over medicines)
router.patch(
  "/:id/dispense",
  authorize("pharmacist"),
  asyncHandler(async (req: Request, res: Response) => {
    const prescription = await Prescription.findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      { status: "dispensed", dispensedBy: req.user!.id, dispensedAt: new Date() },
      { new: true }
    ).populate(populate);
    if (!prescription) throw new ApiError(404, "Prescription not found or already dispensed");
    const patient = prescription.patient as unknown as { name: string; email: string; alternateEmail?: string };
    sendEmail({ to: patient.email, cc: patient.alternateEmail, name: patient.name, ...dispensedEmail({ name: patient.name, count: prescription.items.length }) });
    res.json({ prescription });
  })
);

export default router;
