import { useState } from "react";
import { api, errorMessage } from "../../api/client";
import { usePolling } from "../../hooks/usePolling";
import { Empty, ErrorText, PageTitle, StatCard, StatusPill, today } from "../../components/ui";
import type { Appointment, Trip } from "../../types";

interface QueueResponse {
  date: string;
  stats: { waiting: number; inConsultation: number; completed: number; noShow: number; booked: number };
  appointments: Appointment[];
}

function QueueActions({ a, setStatus, full = false }: { a: Appointment; setStatus: (id: string, s: string) => void; full?: boolean }) {
  const size = full ? "flex-1" : "h-9 px-3 text-sm";
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
  const rows = (queue.data?.appointments ?? []).filter((a) =>
    `${a.patient.name} ${a.patient.phone ?? ""} ${a.token ?? ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <PageTitle
        action={
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <label className="sr-only" htmlFor="search">Search</label>
            <input id="search" className="input sm:w-64" placeholder="Search name, phone or token" value={search} onChange={(e) => setSearch(e.target.value)} />
            <label className="sr-only" htmlFor="date">Date</label>
            <input id="date" type="date" className="input sm:w-44" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        }
      >
        OPD queue
      </PageTitle>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        <StatCard label="Booked" value={s?.booked ?? 0} />
        <StatCard label="Waiting" value={s?.waiting ?? 0} />
        <StatCard label="In consultation" value={s?.inConsultation ?? 0} />
        <StatCard label="Completed" value={s?.completed ?? 0} />
        <StatCard label="No-show" value={s?.noShow ?? 0} />
      </div>

      <ErrorText message={error} />
      {/* Phones: one card per patient */}
      <section className="mt-2 flex flex-col gap-3 md:hidden">
        {rows.map((a) => (
          <div key={a._id} className="card flex flex-col gap-3">
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
            <QueueActions a={a} setStatus={setStatus} full />
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
          <tbody>
            {rows.map((a) => (
              <tr key={a._id} className="border-t border-line">
                <td className="px-6 py-3 font-bold">{a.token ?? "—"}</td>
                <td className="px-3">{a.patient.name}<div className="text-xs text-muted">{a.patient.phone}</div></td>
                <td className="px-3">{a.doctor.name}</td>
                <td className="px-3">{a.slot}</td>
                <td className="px-3"><StatusPill status={a.status} /></td>
                <td className="px-6 py-3"><QueueActions a={a} setStatus={setStatus} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty>No appointments for this day.</Empty>}
      </section>

      <section className="card mt-6">
        <h2 className="mb-3 text-lg font-semibold">Active ambulance trips</h2>
        {!trips.data?.length && <Empty>No active trips.</Empty>}
        <ul className="divide-y divide-line">
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
