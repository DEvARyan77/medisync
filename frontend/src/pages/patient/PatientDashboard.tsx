import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { usePolling } from "../../hooks/usePolling";
import { Empty, ErrorText, PageTitle, StatusPill, today } from "../../components/ui";
import type { Appointment, Prescription, User } from "../../types";
import { DateStrip, addDaysStr, formatDate } from "../../components/DatePicker";

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
      <PageTitle action={<Link to="/patient/ambulance" className="btn-danger animate-pulse-ring">Request ambulance</Link>}>Hello, {user?.name}</PageTitle>

      <div className="stagger mb-6 grid gap-4 md:grid-cols-3">
        <div className="card card-hover p-5">
          <div className="text-xs font-semibold text-muted uppercase">Today's token</div>
          <div key={todays?.token} className="font-display animate-pop text-4xl font-bold text-brand">{todays?.token ?? "—"}</div>
          <div className="text-sm text-muted">{todays ? <StatusPill status={todays.status} /> : "Check in at reception to get a token"}</div>
        </div>
        <div className="card card-hover p-5">
          <div className="text-xs font-semibold text-muted uppercase">Next appointment</div>
          {upcoming[0] ? (
            <>
              <div className="text-lg font-semibold">{upcoming[0].doctor.name}</div>
              <div className="text-sm text-muted">{formatDate(upcoming[0].date)} · {upcoming[0].slot} · {upcoming[0].doctor.department}</div>
            </>
          ) : (
            <div className="text-muted">None booked</div>
          )}
        </div>
        <div className="card card-hover p-5">
          <div className="text-xs font-semibold text-muted uppercase">Prescriptions</div>
          <div className="font-display text-4xl font-bold">{data?.prescriptions.length ?? 0}</div>
          <Link to="/patient/history" className="text-sm font-semibold text-brand">View health timeline</Link>
        </div>
      </div>

      <BookAppointment onBooked={refresh} />

      <section className="card mt-6">
        <h2 className="mb-3 text-lg font-semibold">My appointments</h2>
        {!data?.appointments.length && <Empty>No appointments yet.</Empty>}
        <div className="stagger divide-y divide-line">
          {data?.appointments.map((a) => (
            <div key={a._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <div className="font-semibold">{a.doctor.name} <span className="font-normal text-muted">· {a.doctor.department}</span></div>
                <div className="text-sm text-muted">{formatDate(a.date)} at {a.slot}{a.token ? ` · Token ${a.token}` : ""}</div>
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
  const [maxDate, setMaxDate] = useState<string>(addDaysStr(today(), 30));
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
      setMsg(`Booked for ${formatDate(date)} at ${slot}. Check in at reception on the day to get your token. A confirmation email is on its way.`);
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
      <div className="grid gap-4 md:grid-cols-2">
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
      </div>

      <div className="mt-5">
        <div className="label">Date</div>
        <DateStrip id="date" value={date} onChange={setDate} min={today()} max={maxDate} />
      </div>

      {!doctorId && <p className="mt-4 text-sm text-muted">Choose a doctor to see open time slots.</p>}

      {slots.length > 0 && (
        <div key={`${doctorId}-${date}`} className="mt-5 animate-page-in">
          <div className="mb-2 text-sm font-medium">
            Time slots on {formatDate(date, { weekday: "long", day: "numeric", month: "short" })}{" "}
            <span className="font-normal text-muted">· {openSlots} open</span>
          </div>
          {openSlots === 0 && (
            <p className="mb-2 animate-pop-in rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No slots left on this day. Try another date or doctor.
            </p>
          )}
          <div className="stagger grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
            {slots.map((s) => {
              const sel = slot === s.slot;
              return (
                <button
                  key={s.slot}
                  type="button"
                  disabled={!s.available}
                  aria-pressed={sel}
                  onClick={() => setSlot(s.slot)}
                  className={[
                    "flex h-12 flex-col items-center justify-center rounded-xl border px-4 leading-tight transition-[transform,background-color,box-shadow,border-color] duration-300 ease-(--ease-spring)",
                    sel
                      ? "scale-105 border-brand bg-brand font-semibold text-white shadow-lg shadow-brand/30"
                      : "border-line bg-white hover:-translate-y-0.5 hover:border-brand/60 hover:shadow-md active:scale-95",
                    "disabled:translate-y-0 disabled:scale-100 disabled:border-dashed disabled:bg-page disabled:text-slate-400 disabled:shadow-none",
                  ].join(" ")}
                >
                  <span className="font-semibold">{s.slot}</span>
                  {s.reason && <span className="text-[11px]">{slotReason[s.reason]}</span>}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="reason">Reason</label>
            <input id="reason" className="input sm:max-w-md" placeholder="Reason for visit (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <button className="btn-primary w-full sm:w-auto" disabled={!slot} onClick={book}>
              {slot ? `Book ${slot}` : "Pick a time"}
            </button>
          </div>
        </div>
      )}
      <div className="mt-3"><ErrorText message={error} /></div>
      {msg && <p className="mt-3 animate-pop-in rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand">{msg}</p>}
    </section>
  );
}
