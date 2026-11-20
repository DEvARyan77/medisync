# MediSync: OPD, Pharmacy & Ambulance Platform

A full-stack hospital OPD platform: patients book appointments, reception runs a token queue, doctors consult and write e-prescriptions, the pharmacy dispenses, and patients can request an ambulance and track it live on a map.

**Stack:** React + Vite + TypeScript + Tailwind · Node.js + Express + TypeScript · MongoDB (Mongoose) · JWT auth · Leaflet + OpenStreetMap

## Roles

| Role | What they do |
|---|---|
| Patient | Register, book OPD slots, see token and health timeline, request an ambulance and see nearby ambulances on a map |
| Receptionist | Daily OPD queue: check in (assigns token), send in, no-show; sees active ambulance trips |
| Doctor | Own queue, patient history, vitals, diagnosis, e-prescription |
| Pharmacist | Incoming prescriptions, mark dispensed |
| Driver | Go on/off duty, share GPS, accept requests, update trip status |
| Admin | Create staff accounts, view all users |

## Folder structure

```
medisync/
├── backend/
│   └── src/
│       ├── app.ts, server.ts
│       ├── config/          env + MongoDB connection
│       ├── middleware/      JWT auth, role check, error handler
│       ├── utils/
│       ├── scripts/seed.ts  demo users
│       └── modules/
│           ├── auth/           signup, login, staff creation, User model
│           ├── users/          doctor list, patient search
│           ├── appointments/   slots, booking, token queue
│           ├── consultations/  doctor visit + creates prescription
│           ├── prescriptions/  pharmacy list + dispense
│           └── ambulance/      requests, nearby ($near geo query), live trip
└── frontend/
    └── src/
        ├── api/client.ts         axios + JWT
        ├── context/AuthContext   login state
        ├── components/           Layout, ProtectedRoute, AmbulanceMap, ui
        └── pages/                patient/, reception/, doctor/, pharmacy/, driver/, admin/
```

## Run locally

1. Create a free MongoDB Atlas cluster and copy its connection string.
2. Backend:
   ```bash
   cd backend
   cp .env.example .env      # paste MONGODB_URI and set JWT_SECRET
   npm install
   npm run seed              # demo users, password: password123
   npm run dev               # http://localhost:5000/api/health
   ```
3. Frontend (new terminal):
   ```bash
   cd frontend
   cp .env.example .env
   npm install
   npm run dev               # http://localhost:5173
   ```
4. On the login page, click a demo role button to fill in its login.

**Demo flow:** Patient books a slot → Receptionist checks them in (token A-1) → Doctor opens the patient, writes a prescription → Pharmacist dispenses → Patient sees it in their health timeline.

**Ambulance demo:** Log in as Driver in one browser (allow location; turn "Available" on). Log in as Patient in another, open *Request ambulance*: the driver shows up on the map with distance and ETA. Request, accept as driver, and step through the trip.

## API overview

| Method | Path | Who |
|---|---|---|
| POST | /api/auth/register · /api/auth/login | public |
| POST | /api/auth/staff | admin |
| GET | /api/users/doctors | logged in |
| GET | /api/appointments/slots?doctorId&date | logged in |
| POST | /api/appointments | patient, reception |
| GET | /api/appointments/queue?date | reception, doctor |
| PATCH | /api/appointments/:id/status | by role |
| POST | /api/consultations | doctor |
| GET | /api/prescriptions?status · PATCH /:id/dispense | pharmacist |
| GET | /api/ambulance/nearby?lat&lng | logged in |
| POST | /api/ambulance | patient, reception |
| PATCH | /api/ambulance/location · /:id/accept · /:id/status | driver |

## Deploy (free tiers)

- **Database:** MongoDB Atlas M0. In Network Access allow `0.0.0.0/0` so Render can connect.
- **Backend → Render:** new Web Service, root `backend`, build `npm install --include=dev && npm run build`, start `npm start`. Add the env vars from `.env.example` (`SEED_DEMO=true` creates the demo logins on startup); set `CLIENT_URL` to your Vercel URL.
- **Frontend → Vercel:** import the repo, root `frontend`, set `VITE_API_URL=https://<your-render-app>.onrender.com/api`.

GPS in the browser needs HTTPS, which Vercel provides.

## Roadmap

- **Phase 2:** pharmacy inventory, billing, generic alternatives, drug interaction and allergy checks (openFDA / RxNorm)
- **Phase 3:** FHIR-format health records, records from other hospitals with patient consent, Synthea demo data
- **Phase 4:** AI prescription scanner, email/SMS reminders, Socket.io live updates (replacing polling)
