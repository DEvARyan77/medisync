import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Layout } from "./components/Layout";
import { ProtectedRoute, homeFor } from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import PatientDashboard from "./pages/patient/PatientDashboard";
import PatientHistory from "./pages/patient/PatientHistory";
import PatientAmbulance from "./pages/patient/PatientAmbulance";
import ReceptionQueue from "./pages/reception/ReceptionQueue";
import DoctorOPD from "./pages/doctor/DoctorOPD";
import PharmacyPage from "./pages/pharmacy/PharmacyPage";
import DriverPortal from "./pages/driver/DriverPortal";
import AdminUsers from "./pages/admin/AdminUsers";
import ProfilePage from "./pages/ProfilePage";
import { ForgotPassword, ResetPassword } from "./pages/ForgotPassword";

const ALL_ROLES = ["patient", "doctor", "receptionist", "pharmacist", "driver", "admin"] as const;

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-10 text-muted">Loading…</p>;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<Layout />}>
        <Route element={<ProtectedRoute roles={[...ALL_ROLES]} />}>
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route element={<ProtectedRoute roles={["patient"]} />}>
          <Route path="/patient" element={<PatientDashboard />} />
          <Route path="/patient/history" element={<PatientHistory />} />
          <Route path="/patient/ambulance" element={<PatientAmbulance />} />
        </Route>
        <Route element={<ProtectedRoute roles={["receptionist", "admin"]} />}>
          <Route path="/reception" element={<ReceptionQueue />} />
        </Route>
        <Route element={<ProtectedRoute roles={["doctor"]} />}>
          <Route path="/doctor" element={<DoctorOPD />} />
        </Route>
        <Route element={<ProtectedRoute roles={["pharmacist"]} />}>
          <Route path="/pharmacy" element={<PharmacyPage />} />
        </Route>
        <Route element={<ProtectedRoute roles={["driver"]} />}>
          <Route path="/driver" element={<DriverPortal />} />
        </Route>
        <Route element={<ProtectedRoute roles={["admin"]} />}>
          <Route path="/admin" element={<AdminUsers />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={user ? homeFor[user.role] : "/login"} replace />} />
    </Routes>
  );
}
