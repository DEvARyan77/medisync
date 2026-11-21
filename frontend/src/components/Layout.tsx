import { ReactNode, useEffect, useState } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { homeFor } from "./ProtectedRoute";
import type { Role } from "../types";

// Small line icons, shown alone when the sidebar is collapsed
const path = (d: string) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const icons: Record<string, ReactNode> = {
  home: path("M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10"),
  timeline: path("M12 8v4l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z"),
  ambulance: path("M3 17V8h11v9M14 11h4l3 3v3h-7M7 17a2 2 0 104 0M16 17a2 2 0 104 0M8.5 10.5v3M7 12h3"),
  queue: path("M4 6h16M4 12h16M4 18h10"),
  stethoscope: path("M6 3v6a4 4 0 008 0V3M10 13v3a5 5 0 0010 0v-2M20 12a2 2 0 100-4 2 2 0 000 4"),
  pill: path("M10.5 3.5a5 5 0 017 7l-7 7a5 5 0 01-7-7l7-7zM7 10l7 7"),
  car: path("M5 17h14M6 13l2-6h8l2 6M5 13h14v4H5zM7 17v2M17 17v2"),
  users: path("M16 20v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 10a4 4 0 100-8 4 4 0 000 8zM22 20v-2a4 4 0 00-3-3.9M16 2.1a4 4 0 010 7.8"),
  logout: path("M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"),
};

const menus: Record<Role, { to: string; label: string; icon: string; danger?: boolean }[]> = {
  patient: [
    { to: "/patient", label: "Dashboard", icon: "home" },
    { to: "/patient/history", label: "Health timeline", icon: "timeline" },
    { to: "/patient/ambulance", label: "Request ambulance", icon: "ambulance", danger: true },
  ],
  receptionist: [{ to: "/reception", label: "Today's queue", icon: "queue" }],
  doctor: [{ to: "/doctor", label: "My OPD", icon: "stethoscope" }],
  pharmacist: [{ to: "/pharmacy", label: "Prescriptions", icon: "pill" }],
  driver: [{ to: "/driver", label: "Trips", icon: "car" }],
  admin: [
    { to: "/admin", label: "Users", icon: "users" },
    { to: "/reception", label: "OPD queue", icon: "queue" },
  ],
};

const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  // Desktop sidebar can be collapsed to icons; remembered in this browser
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("sidebar") === "collapsed");

  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => localStorage.setItem("sidebar", collapsed ? "collapsed" : "open"), [collapsed]);

  if (!user) return <Navigate to="/login" replace />;

  const doLogout = () => {
    logout();
    navigate("/login");
  };

  const nav = (mini: boolean) => (
    <>
      {menus[user.role].map((m) => (
        <NavLink
          key={m.to}
          to={m.to}
          end
          title={mini ? m.label : undefined}
          className={({ isActive }) =>
            [
              "flex items-center gap-3 rounded-lg py-3 transition-[transform,background-color,color] duration-300 ease-(--ease-spring) active:scale-95",
              mini ? "justify-center px-0" : "px-3 hover:translate-x-1",
              m.danger
                ? isActive
                  ? "bg-danger font-semibold text-white"
                  : "border border-red-200 bg-red-50 font-semibold text-danger hover:bg-red-100"
                : isActive
                  ? "bg-brand-soft font-semibold text-brand"
                  : "hover:bg-page",
            ].join(" ")
          }
        >
          {icons[m.icon]}
          {!mini && <span>{m.label}</span>}
        </NavLink>
      ))}

      <div className={`mt-auto flex flex-col gap-2 border-t border-line pt-4 text-sm`}>
        {/* Your name opens your profile */}
        <NavLink
          to="/profile"
          title={mini ? `${user.name}: profile` : undefined}
          className={({ isActive }) =>
            `group flex items-center gap-3 rounded-xl p-2 transition-[background-color,transform] duration-300 ease-(--ease-spring) active:scale-95 ${mini ? "justify-center" : ""} ${isActive ? "bg-brand-soft" : "hover:bg-page"}`
          }
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand font-semibold text-white transition-transform duration-300 ease-(--ease-spring) group-hover:scale-110">
            {initials(user.name)}
          </span>
          {!mini && (
            <span className="min-w-0">
              <span className="block truncate font-semibold">{user.name}</span>
              <span className="block text-muted capitalize">{user.role} · View profile</span>
            </span>
          )}
        </NavLink>
        <button
          type="button"
          title={mini ? "Log out" : undefined}
          onClick={doLogout}
          className={`flex min-h-11 items-center gap-2 rounded-lg border border-line bg-white font-semibold text-slate-700 transition-[transform,background-color,border-color,color] duration-300 ease-(--ease-spring) hover:border-danger hover:bg-red-50 hover:text-danger active:scale-95 ${mini ? "justify-center px-0" : "justify-center px-3"}`}
        >
          {icons.logout}
          {!mini && "Log out"}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-page text-slate-900 md:flex">
      {/* Phone / small tablet: top bar with a menu button */}
      <header className="sticky top-0 z-[1000] border-b border-line bg-white md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to={homeFor[user.role]} className="font-display text-xl font-bold text-brand">MediSync</Link>
          <button
            className="flex h-11 w-11 items-center justify-center rounded-lg transition-transform duration-300 ease-(--ease-spring) hover:bg-page active:scale-90"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <g className={`origin-center transition-transform duration-300 ease-(--ease-spring) ${menuOpen ? "rotate-90" : ""}`}>{menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</g>
            </svg>
          </button>
        </div>
        {menuOpen && <nav className="stagger flex origin-top animate-drop-in flex-col gap-1 border-t border-line p-3">{nav(false)}</nav>}
      </header>

      {/* Desktop: sidebar that can be collapsed to icons */}
      <nav
        className={`sticky top-0 hidden h-screen shrink-0 flex-col gap-1 border-r border-line bg-white transition-[width,padding] duration-300 ease-(--ease-out-soft) md:flex ${collapsed ? "w-[76px] p-3" : "w-64 p-5"}`}
        aria-label="Main"
      >
        <div className={`flex items-center pb-4 ${collapsed ? "flex-col gap-3" : "justify-between"}`}>
          <Link to={homeFor[user.role]} className={`font-display font-bold text-brand ${collapsed ? "text-xl" : "px-3 text-2xl"}`}>
            {collapsed ? "M" : "MediSync"}
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-muted transition-[transform,background-color,color] duration-300 ease-(--ease-spring) hover:bg-page hover:text-brand active:scale-90"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`transition-transform duration-300 ease-(--ease-spring) ${collapsed ? "rotate-180" : ""}`}>
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
        </div>
        {nav(collapsed)}
      </nav>

      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-10">
        {/* key = path, so every page plays its entrance animation */}
        <div key={location.pathname} className="animate-page-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
