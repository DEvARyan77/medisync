import { ReactNode } from "react";

const statusStyles: Record<string, string> = {
  booked: "bg-slate-100 text-slate-700",
  checked_in: "bg-amber-100 text-amber-800",
  in_consultation: "bg-brand-soft text-brand",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-slate-100 text-slate-500",
  no_show: "bg-red-100 text-red-800",
  pending: "bg-amber-100 text-amber-800",
  dispensed: "bg-emerald-100 text-emerald-800",
  requested: "bg-red-100 text-red-800",
  accepted: "bg-brand-soft text-brand",
  arrived: "bg-brand-soft text-brand",
  on_board: "bg-brand-soft text-brand",
};

const statusLabels: Record<string, string> = {
  checked_in: "Waiting",
  in_consultation: "In consultation",
  no_show: "No-show",
  on_board: "Patient on board",
  accepted: "Driver on the way",
  arrived: "Arrived at pickup",
};

export function StatusPill({ status }: { status: string }) {
  return <span className={`pill ${statusStyles[status] ?? "bg-slate-100"}`}>{statusLabels[status] ?? status.replace("_", " ")}</span>;
}

export function PageTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 sm:mb-6 sm:gap-4">
      <h1 className="text-xl font-bold sm:text-3xl">{children}</h1>
      {action}
    </div>
  );
}

export function StatCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="card p-3 sm:p-5">
      <div className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</div>
      <div className="font-display text-2xl font-bold sm:text-3xl">{value}</div>
    </div>
  );
}

export function ErrorText({ message }: { message: string }) {
  if (!message) return null;
  return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{message}</p>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted">{children}</p>;
}

// Local date as YYYY-MM-DD ("en-CA" formats dates that way). toISOString() would give the
// UTC date, which is still "yesterday" in India between midnight and 5:30 AM.
export const today = () => new Date().toLocaleDateString("en-CA");
