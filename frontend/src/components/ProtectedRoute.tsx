import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../types";

export const homeFor: Record<Role, string> = {
  patient: "/patient",
  receptionist: "/reception",
  doctor: "/doctor",
  pharmacist: "/pharmacy",
  driver: "/driver",
  admin: "/admin",
};

export function ProtectedRoute({ roles }: { roles: Role[] }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-10 text-muted">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor[user.role]} replace />;
  return <Outlet />;
}
