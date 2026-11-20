import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../types";

const menus: Record<Role, { to: string; label: string; danger?: boolean }[]> = {
  patient: [
    { to: "/patient", label: "Dashboard" },
    { to: "/patient/history", label: "Health timeline" },
    { to: "/patient/ambulance", label: "Request ambulance", danger: true },
  ],
  receptionist: [{ to: "/reception", label: "Today's queue" }],
  doctor: [{ to: "/doctor", label: "My OPD" }],
  pharmacist: [{ to: "/pharmacy", label: "Prescriptions" }],
  driver: [{ to: "/driver", label: "Trips" }],
  admin: [
    { to: "/admin", label: "Users" },
    { to: "/reception", label: "OPD queue" },
  ],
};

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col bg-page text-slate-900 md:flex-row">
      <nav className="flex flex-col gap-1 border-b border-line bg-white p-5 md:w-64 md:border-r md:border-b-0">
        <div className="font-display px-3 pb-4 text-2xl font-bold text-brand">MediSync</div>
        {menus[user.role].map((m) => (
          <NavLink
            key={m.to}
            to={m.to}
            end
            className={({ isActive }) =>
              m.danger
                ? "mt-2 rounded-lg bg-danger px-3 py-3 text-center font-semibold text-white"
                : `rounded-lg px-3 py-3 ${isActive ? "bg-brand-soft font-semibold text-brand" : "hover:bg-page"}`
            }
          >
            {m.label}
          </NavLink>
        ))}
        <div className="mt-auto border-t border-line pt-4 text-sm">
          <div className="px-3 font-semibold">{user.name}</div>
          <div className="px-3 text-muted capitalize">{user.role}</div>
          <button
            className="mt-2 w-full rounded-lg px-3 py-2 text-left text-muted hover:bg-page"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Log out
          </button>
        </div>
      </nav>
      <main className="min-w-0 flex-1 p-5 md:p-10">
        <Outlet />
      </main>
    </div>
  );
}
