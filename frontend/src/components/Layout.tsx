import { useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
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
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the phone menu after navigating.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  if (!user) return <Navigate to="/login" replace />;

  const nav = (
    <>
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
          className="mt-2 min-h-11 w-full rounded-lg px-3 py-2 text-left text-muted hover:bg-page"
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          Log out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-page text-slate-900 md:flex">
      {/* Phone / small tablet: top bar with a menu button */}
      <header className="sticky top-0 z-[1000] border-b border-line bg-white md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <span className="font-display text-xl font-bold text-brand">MediSync</span>
          <button
            className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-page"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
        {menuOpen && <nav className="flex flex-col gap-1 border-t border-line p-3">{nav}</nav>}
      </header>

      {/* Desktop: fixed sidebar */}
      <nav className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-1 border-r border-line bg-white p-5 md:flex">
        <div className="font-display px-3 pb-4 text-2xl font-bold text-brand">MediSync</div>
        {nav}
      </nav>

      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-10">
        <Outlet />
      </main>
    </div>
  );
}
