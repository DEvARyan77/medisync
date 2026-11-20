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
          <div className="flex flex-wrap gap-3">
            <label className="sr-only" htmlFor="search">Search</label>
            <input id="search" className="input w-64" placeholder="Search name, phone or token" value={search} onChange={(e) => setSearch(e.target.value)} />
            <label className="sr-only" htmlFor="date">Date</label>
            <input id="date" type="date" className="input w-44" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        }
      >
        OPD queue
      </PageTitle>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Booked" value={s?.booked ?? 0} />
        <StatCard label="Waiting" value={s?.waiting ?? 0} />
        <StatCard label="In consultation" value={s?.inConsultation ?? 0} />
        <StatCard label="Completed" value={s?.completed ?? 0} />
        <StatCard label="No-show" value={s?.noShow ?? 0} />
      </div>

      <ErrorText message={error} />
      <section className="card mt-2 overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-left text-[15px]">
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
                <td className="flex gap-2 px-6 py-3">
                  {a.status === "booked" && (
                    <>
                      <button className="btn-primary h-9 px-3 text-sm" onClick={() => setStatus(a._id, "checked_in")}>Check in</button>
                      <button className="btn-ghost h-9 px-3 text-sm" onClick={() => setStatus(a._id, "no_show")}>No-show</button>
                    </>
                  )}
                  {a.status === "checked_in" && (
                    <button className="btn-outline h-9 px-3 text-sm" onClick={() => setStatus(a._id, "in_consultation")}>Send in</button>
                  )}
                </td>
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
