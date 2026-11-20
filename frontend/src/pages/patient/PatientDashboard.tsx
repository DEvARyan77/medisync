import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { usePolling } from "../../hooks/usePolling";
import { Empty, ErrorText, PageTitle, StatusPill, today } from "../../components/ui";
import type { Appointment, Prescription, User } from "../../types";

export default function PatientDashboard() {
  const { user } = useAuth();
  const { data, refresh } = usePolling(async () => {
    const [a, p] = await Promise.all([api.get("/appointments/mine"), api.get("/prescriptions")]);
    return { appointments: a.data.appointments as Appointment[], prescriptions: p.data.prescriptions as Prescription[] };
  }, 15000);

  const todays = data?.appointments.find((a) => a.date === today() && ["booked", "checked_in", "in_consultation"].includes(a.status));
  const upcoming = data?.appointments.filter((a) => a.date >= today() && a.status === "booked") ?? [];

  async function cancel(id: string) {
    await api.patch(`/appointments/${id}/status`, { status: "cancelled" });
    refresh();
  }

  return (
    <>
      <PageTitle action={<Link to="/patient/ambulance" className="btn-danger">Request ambulance</Link>}>Hello, {user?.name}</PageTitle>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <div className="text-xs font-semibold text-muted uppercase">Today's token</div>
          <div className="font-display text-4xl font-bold text-brand">{todays?.token ?? "—"}</div>
          <div className="text-sm text-muted">{todays ? <StatusPill status={todays.status} /> : "Check in at reception to get a token"}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-muted uppercase">Next appointment</div>
          {upcoming[0] ? (
            <>
              <div className="text-lg font-semibold">{upcoming[0].doctor.name}</div>
              <div className="text-sm text-muted">{upcoming[0].date} · {upcoming[0].slot} · {upcoming[0].doctor.department}</div>
            </>
          ) : (
            <div className="text-muted">None booked</div>
          )}
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-muted uppercase">Prescriptions</div>
          <div className="font-display text-4xl font-bold">{data?.prescriptions.length ?? 0}</div>
          <Link to="/patient/history" className="text-sm font-semibold text-brand">View health timeline</Link>
        </div>
      </div>

      <BookAppointment onBooked={refresh} />

      <section className="card mt-6">
        <h2 className="mb-3 text-lg font-semibold">My appointments</h2>
        {!data?.appointments.length && <Empty>No appointments yet.</Empty>}
        <div className="divide-y divide-line">
          {data?.appointments.map((a) => (
            <div key={a._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <div className="font-semibold">{a.doctor.name} <span className="font-normal text-muted">· {a.doctor.department}</span></div>
                <div className="text-sm text-muted">{a.date} at {a.slot}{a.token ? ` · Token ${a.token}` : ""}</div>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill status={a.status} />
                {a.status === "booked" && <button className="text-sm font-semibold text-danger" onClick={() => cancel(a._id)}>Cancel</button>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

interface Slot {
  slot: string;
  available: boolean;
  reason: "past" | "booked" | "too_far" | null;
}

const slotReason = { past: "passed", booked: "booked", too_far: "too far ahead" };

function BookAppointment({ onBooked }: { onBooked: () => void }) {
  const [doctors, setDoctors] = useState<User[]>([]);
  const [department, setDepartment] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(today());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [maxDate, setMaxDate] = useState<string | undefined>();
  const [slot, setSlot] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/users/doctors").then((r) => setDoctors(r.data.doctors));
  }, []);

  useEffect(() => {
    setSlot("");
    if (!doctorId || !date) return setSlots([]);
    api.get("/appointments/slots", { params: { doctorId, date } }).then((r) => {
      setSlots(r.data.slots);
      setMaxDate(r.data.maxDate);
    });
  }, [doctorId, date]);

  const openSlots = slots.filter((s) => s.available).length;

  const departments = [...new Set(doctors.map((d) => d.department).filter(Boolean))] as string[];
  const shown = department ? doctors.filter((d) => d.department === department) : doctors;

  async function book() {
    setError("");
    try {
      await api.post("/appointments", { doctorId, date, slot, reason });
      setMsg(`Booked for ${date} at ${slot}. Check in at reception on the day to get your token.`);
      setSlot("");
      setDoctorId("");
      onBooked();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section className="card">
      <h2 className="mb-4 text-lg font-semibold">Book an OPD appointment</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="label" htmlFor="dept">Department</label>
          <select id="dept" className="input" value={department} onChange={(e) => { setDepartment(e.target.value); setDoctorId(""); }}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="doctor">Doctor</label>
          <select id="doctor" className="input" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            <option value="">Choose a doctor</option>
            {shown.map((d) => <option key={d._id} value={d._id}>{d.name} ({d.department})</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="date">Date</label>
          <input id="date" type="date" className="input" min={today()} max={maxDate} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {slots.length > 0 && (
        <>
          <div className="mt-4 mb-2 text-sm font-medium">
            Available slots <span className="font-normal text-muted">· {openSlots} open</span>
          </div>
          {openSlots === 0 && (
            <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No slots left on this day. Try another date or doctor.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <button
                key={s.slot}
                type="button"
                disabled={!s.available}
                onClick={() => setSlot(s.slot)}
                className={`h-11 rounded-lg border px-4 ${slot === s.slot ? "border-2 border-brand bg-brand-soft font-semibold text-brand" : "border-line"} disabled:border-dashed disabled:bg-page disabled:text-muted`}
              >
                {s.slot}{s.reason && ` · ${slotReason[s.reason]}`}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <label className="sr-only" htmlFor="reason">Reason</label>
            <input id="reason" className="input max-w-md" placeholder="Reason for visit (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <button className="btn-primary" disabled={!slot} onClick={book}>Book appointment</button>
          </div>
        </>
      )}
      <div className="mt-3"><ErrorText message={error} /></div>
      {msg && <p className="mt-3 rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand">{msg}</p>}
    </section>
  );
}
