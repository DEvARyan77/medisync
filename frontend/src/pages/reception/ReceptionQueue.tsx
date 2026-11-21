import { useState } from "react";
import { api, errorMessage } from "../../api/client";
import { usePolling } from "../../hooks/usePolling";
import { Empty, ErrorText, PageTitle, StatCard, StatusPill, today } from "../../components/ui";
import type { Appointment, Trip } from "../../types";
import { DatePicker } from "../../components/DatePicker";

interface QueueResponse {
  date: string;
  stats: { waiting: number; inConsultation: number; completed: number; noShow: number; booked: number };
  appointments: Appointment[];
}

function QueueActions({ a, setStatus, full = false, isToday }: { a: Appointment; setStatus: (id: string, s: string) => void; full?: boolean; isToday: boolean }) {
  const size = full ? "flex-1" : "h-9 px-3 text-sm";
  // Tokens are given only on the day of the visit
  if (!isToday) return full ? null : <span className="text-muted">—</span>;
  if (a.status === "booked") {
    return (
      <div className="flex gap-2">
        <button className={`btn-primary ${size}`} onClick={() => setStatus(a._id, "checked_in")}>Check in</button>
        <button className={`btn-ghost ${size}`} onClick={() => setStatus(a._id, "no_show")}>No-show</button>
      </div>
    );
  }
  if (a.status === "checked_in") {
    return <button className={`btn-outline ${full ? "w-full" : "h-9 px-3 text-sm"}`} onClick={() => setStatus(a._id, "in_consultation")}>Send in</button>;
  }
  return full ? null : <span className="text-muted">—</span>;
}

export default function ReceptionQueue() {
  const [date, setDate] = useState(today());
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const queue = usePolling(async () => (await api.get("/appointments/queue", { params: { date } })).data as QueueResponse, 8000, [date]);
  const trips = usePolling(async () => (await api.get("/ambulance")).data.trips as Trip[], 10000);

  async function setStatus(id: string, status: string) {
    setError("");
    try {
      await api.patch(`/appointments/${id}/status`, { status });
      queue.refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const s = queue.data?.stats;
  const isToday = date === today();
  // In consultation, then waiting by token, then bookings by time, then finished / missed
  const order: Record<string, number> = { in_consultation: 0, checked_in: 1, booked: 2, completed: 3, no_show: 4, cancelled: 5 };
  const sorted = [...(queue.data?.appointments ?? [])].sort(
    (x, y) => order[x.status] - order[y.status] || (x.tokenNumber ?? 0) - (y.tokenNumber ?? 0) || x.slot.localeCompare(y.slot)
  );
  const rows = sorted.filter((a) =>
    `${a.patient.name} ${a.patient.phone ?? ""} ${a.token ?? ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <PageTitle
        action={
          <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row">
            <label className="sr-only" htmlFor="search">Search</label>
            <input id="search" className="input lg:w-64" placeholder="Search name, phone or token" value={search} onChange={(e) => setSearch(e.target.value)} />
            <label className="sr-only" htmlFor="date">Date</label>
            <div className="lg:w-60"><DatePicker id="date" value={date} onChange={setDate} alignRight /></div>
          </div>
        }
      >
        OPD queue
      </PageTitle>

      <div className="stagger mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        <StatCard label="Booked" value={s?.booked ?? 0} />
        <StatCard label="Waiting" value={s?.waiting ?? 0} />
        <StatCard label="In consultation" value={s?.inConsultation ?? 0} />
        <StatCard label="Completed" value={s?.completed ?? 0} />
        <StatCard label="No-show" value={s?.noShow ?? 0} />
      </div>

      <ErrorText message={error} />
      {!isToday && <p className="mb-3 rounded-lg bg-page px-3 py-2 text-sm text-muted">Viewing {date < today() ? "a past" : "a future"} day. Check-in and tokens are only for today.</p>}
      {/* Phones: one card per patient */}
      <section className="stagger mt-2 flex flex-col gap-3 md:hidden">
        {rows.map((a) => (
          <div key={a._id} className="card card-hover flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="font-display min-w-12 text-2xl font-bold text-brand">{a.token ?? "—"}</span>
                <div>
                  <div className="font-semibold">{a.patient.name}</div>
                  <div className="text-sm text-muted">{a.slot} · {a.doctor.name}</div>
                </div>
              </div>
              <StatusPill status={a.status} />
            </div>
            <QueueActions a={a} setStatus={setStatus} full isToday={isToday} />
          </div>
        ))}
        {rows.length === 0 && <div className="card"><Empty>No appointments for this day.</Empty></div>}
      </section>

      {/* Tablets and desktops: table */}
      <section className="card mt-2 hidden overflow-x-auto p-0 md:block sm:p-0">
        <table className="w-full min-w-[720px] text-left text-[15px]">
          <thead className="text-xs text-muted uppercase">
            <tr>
              <th className="px-6 py-4">Token</th><th className="px-3">Patient</th><th className="px-3">Doctor</th><th className="px-3">Slot</th><th className="px-3">Status</th><th className="px-6">Action</th>
            </tr>
          </thead>
          <tbody className="stagger">
            {rows.map((a) => (
              <tr key={a._id} className="border-t border-line transition-colors duration-200 hover:bg-page">
                <td className="px-6 py-3 font-bold">{a.token ?? "—"}</td>
                <td className="px-3">{a.patient.name}<div className="text-xs text-muted">{a.patient.phone}</div></td>
                <td className="px-3">{a.doctor.name}</td>
                <td className="px-3">{a.slot}</td>
                <td className="px-3"><StatusPill status={a.status} /></td>
                <td className="px-6 py-3"><QueueActions a={a} setStatus={setStatus} isToday={isToday} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty>No appointments for this day.</Empty>}
      </section>

      <section className="card mt-6">
        <h2 className="mb-3 text-lg font-semibold">Active ambulance trips</h2>
        {!trips.data?.length && <Empty>No active trips.</Empty>}
        <ul className="stagger divide-y divide-line">
          {trips.data?.map((t) => (
            <li key={t._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <div className="font-semibold">{t.patient.name} <span className="font-normal text-muted">· {t.type}</span></div>
                <div className="text-sm text-muted">{t.pickupAddress} · {t.driver ? `${t.driver.name} (${t.driver.vehicleNumber})` : "No driver yet"}</div>
              </div>
              <StatusPill status={t.status} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
