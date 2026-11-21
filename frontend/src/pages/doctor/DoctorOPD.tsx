import { useEffect, useState } from "react";
import { api, errorMessage } from "../../api/client";
import { usePolling } from "../../hooks/usePolling";
import { Empty, ErrorText, PageTitle, StatusPill } from "../../components/ui";
import type { Appointment, Consultation, Medicine } from "../../types";

const emptyMed: Medicine = { medicine: "", dose: "", frequency: "1-0-1", days: 5, instructions: "" };

function age(dob?: string) {
  if (!dob) return "";
  return `${Math.floor((Date.now() - new Date(dob).getTime()) / 3.15576e10)} y`;
}

export default function DoctorOPD() {
  const queue = usePolling(async () => (await api.get("/appointments/queue")).data.appointments as Appointment[], 8000);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("opd-queue") === "collapsed");

  useEffect(() => localStorage.setItem("opd-queue", collapsed ? "collapsed" : "open"), [collapsed]);

  // Patient in consultation first, then the waiting patients in token order
  const waiting = (queue.data ?? [])
    .filter((a) => ["checked_in", "in_consultation"].includes(a.status))
    .sort((a, b) => (a.status === "in_consultation" ? -1 : 0) - (b.status === "in_consultation" ? -1 : 0) || (a.tokenNumber ?? 0) - (b.tokenNumber ?? 0));
  const done = (queue.data ?? []).filter((a) => a.status === "completed");
  const current = waiting.find((a) => a.status === "in_consultation") ?? null;
  const selected = waiting.find((a) => a._id === selectedId) ?? current;

  return (
    <>
      <PageTitle>My OPD · today</PageTitle>
      <div className={`grid grid-cols-1 gap-6 transition-[grid-template-columns] duration-300 ${collapsed ? "lg:grid-cols-[76px_minmax(0,1fr)]" : "lg:grid-cols-[300px_minmax(0,1fr)]"}`}>
        <aside className={`card flex h-fit flex-col gap-2 p-3 sm:p-4 lg:sticky lg:top-6 ${collapsed ? "lg:items-center" : ""}`}>
          <div className={`flex items-center gap-2 ${collapsed ? "lg:flex-col" : "justify-between"}`}>
            <h2 className={`px-2 text-xs font-semibold text-muted uppercase ${collapsed ? "lg:px-0 lg:text-center" : ""}`}>
              Queue <span className="rounded-full bg-brand-soft px-2 py-0.5 text-brand">{waiting.length}</span>
            </h2>
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-expanded={!collapsed}
              aria-controls="opd-queue"
              title={collapsed ? "Show queue" : "Hide queue"}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-muted transition-[transform,background-color,color] duration-300 ease-(--ease-spring) hover:bg-page hover:text-brand active:scale-90"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                className={`transition-transform duration-300 ease-(--ease-spring) ${collapsed ? "rotate-180 max-lg:rotate-90" : "max-lg:-rotate-90"}`}>
                <path d="M15 6l-6 6 6 6" />
              </svg>
              <span className="sr-only">{collapsed ? "Show queue" : "Hide queue"}</span>
            </button>
          </div>

          {/* Collapsed on desktop: just the tokens */}
          {collapsed && (
            <div className="hidden flex-col items-center gap-2 lg:flex">
              {waiting.map((a) => (
                <button key={a._id} title={`${a.token} · ${a.patient.name}`} onClick={() => setSelectedId(a._id)}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl text-xs font-bold transition-transform duration-300 ease-(--ease-spring) hover:scale-110 active:scale-90 ${a.status === "in_consultation" ? "bg-brand text-white" : selected?._id === a._id ? "bg-brand-soft text-brand ring-2 ring-brand" : "bg-page text-slate-700"}`}>
                  {a.token}
                </button>
              ))}
            </div>
          )}

          <div id="opd-queue" className={`stagger no-scrollbar flex max-h-80 flex-col gap-1.5 overflow-y-auto lg:max-h-[calc(100vh-12rem)] ${collapsed ? "hidden" : ""}`}>
            {waiting.map((a) => {
              const isSel = selected?._id === a._id;
              return (
                <button
                  key={a._id}
                  onClick={() => {
                    setSelectedId(a._id);
                    setTimeout(() => document.getElementById("consult")?.scrollIntoView({ behavior: "smooth" }), 50);
                  }}
                  className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-[transform,background-color,border-color] duration-300 ease-(--ease-spring) hover:translate-x-1 active:scale-95 ${isSel ? "border-brand bg-brand-soft" : "border-transparent hover:bg-page"}`}
                >
                  <span className="min-w-0">
                    <span className={`block text-xs font-bold ${isSel ? "text-brand" : "text-muted"}`}>{a.token}</span>
                    <span className={`block truncate ${isSel ? "font-semibold text-brand" : ""}`}>{a.patient.name}</span>
                  </span>
                  <span className="whitespace-nowrap"><StatusPill status={a.status} /></span>
                </button>
              );
            })}
            {waiting.length === 0 && <Empty>No patients waiting.</Empty>}
            {done.length > 0 && <p className="mt-3 px-2 text-sm text-muted">Seen today: {done.length}</p>}
          </div>
        </aside>

        {selected ? (
          <ConsultationForm
            key={selected._id}
            appointment={selected}
            current={current}
            onChange={queue.refresh}
            onDone={() => {
              setSelectedId(null);
              queue.refresh();
            }}
          />
        ) : (
          <div className="card"><Empty>Select a patient from the queue to start the consultation.</Empty></div>
        )}
      </div>
    </>
  );
}

const VITALS = [
  ["bloodPressure", "Blood pressure", "120/80", "mmHg"],
  ["pulse", "Pulse", "72", "/min"],
  ["temperatureF", "Temperature", "98.6", "°F"],
  ["weightKg", "Weight", "70", "kg"],
] as const;

function ConsultationForm({ appointment, current, onChange, onDone }: { appointment: Appointment; current: Appointment | null; onChange: () => void; onDone: () => void }) {
  const p = appointment.patient;
  const [vitals, setVitals] = useState({ bloodPressure: "", pulse: "", temperatureF: "", weightKg: "" });
  const [chiefComplaint, setChiefComplaint] = useState(appointment.reason ?? "");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [meds, setMeds] = useState<Medicine[]>([{ ...emptyMed }]);
  const [history, setHistory] = useState<Consultation[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/consultations/patient/${p._id}`).then((r) => setHistory(r.data.consultations));
  }, [p._id]);

  const started = appointment.status === "in_consultation";
  const someoneElse = current && current._id !== appointment._id ? current : null;

  async function start() {
    setBusy(true);
    setError("");
    try {
      await api.patch(`/appointments/${appointment._id}/status`, { status: "in_consultation" });
      onChange();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const setMed = (i: number, k: keyof Medicine, v: string) =>
    setMeds(meds.map((m, j) => (j === i ? { ...m, [k]: k === "days" ? Number(v) : v } : m)));

  async function finish() {
    setBusy(true);
    setError("");
    try {
      const clean = Object.fromEntries(Object.entries(vitals).filter(([, v]) => v !== ""));
      await api.post("/consultations", {
        appointmentId: appointment._id,
        vitals: clean,
        chiefComplaint,
        diagnosis,
        notes,
        medicines: meds.filter((m) => m.medicine.trim()),
      });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="consult" className="grid min-w-0 animate-page-in grid-cols-1 scroll-mt-16 gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="stagger flex min-w-0 flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold sm:text-2xl">{p.name} <span className="font-normal text-muted">· {age(p.dateOfBirth)} {p.gender}</span></h2>
            <p className="text-sm text-muted">
              Token {appointment.token}
              {p.bloodGroup && <> · Blood group <b>{p.bloodGroup}</b></>} · Allergies:{" "}
              <b className="text-amber-800">{p.allergies?.length ? p.allergies.join(", ") : "none recorded"}</b>
            </p>
          </div>
          {started ? (
            <button className="btn-primary w-full sm:w-auto" disabled={busy || !chiefComplaint || !diagnosis} onClick={finish}
              title={!chiefComplaint || !diagnosis ? "Fill in the chief complaint and diagnosis" : undefined}>
              {busy ? "Saving…" : "Finish & send to pharmacy"}
            </button>
          ) : (
            <button className="btn-primary w-full sm:w-auto" disabled={busy || Boolean(someoneElse)} onClick={start}>
              {busy ? "Starting…" : "Start consultation"}
            </button>
          )}
        </div>
        {!started && someoneElse && (
          <p className="animate-pop-in rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {someoneElse.token} · {someoneElse.patient.name} is in consultation. Finish that visit first, then start this one.
          </p>
        )}
        <ErrorText message={error} />

        <section className="@container card">
          <h3 className="mb-3 font-semibold">Vitals</h3>
          <div className="grid grid-cols-1 gap-3 @[22rem]:grid-cols-2 @[40rem]:grid-cols-4">
            {VITALS.map(([k, l, ph, unit]) => (
              <div key={k} className="min-w-0">
                <label className="label whitespace-nowrap" htmlFor={k}>{l}</label>
                <div className="relative">
                  <input id={k} className="input pr-14" inputMode={k === "bloodPressure" ? "text" : "decimal"} placeholder={ph}
                    value={vitals[k]} onChange={(e) => setVitals({ ...vitals, [k]: e.target.value })} aria-describedby={`${k}-unit`} />
                  <span id={`${k}-unit`} className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">{unit}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card flex flex-col gap-3">
          <h3 className="font-semibold">Notes and diagnosis</h3>
          <div><label className="label" htmlFor="cc">Chief complaint *</label><textarea id="cc" rows={2} className="w-full rounded-lg border border-line p-3" value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} /></div>
          <div><label className="label" htmlFor="dx">Diagnosis *</label><input id="dx" className="input" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} /></div>
          <div><label className="label" htmlFor="notes">Notes</label><textarea id="notes" rows={2} className="w-full rounded-lg border border-line p-3" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </section>

        <section className="@container card">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold">e-Prescription</h3>
            <button className="btn-outline h-9 px-3 text-sm" onClick={() => setMeds([...meds, { ...emptyMed }])}>+ Add medicine</button>
          </div>
          <p className="mb-4 text-sm text-muted">
            One row per medicine. <b>Frequency</b> is morning-afternoon-night: 1-0-1 means one in the morning and one at night.
          </p>
          {/* column headings on wide cards; each field has its own label on narrow ones */}
          <div className="hidden gap-2 px-1 pb-1 text-xs font-semibold text-muted uppercase @[44rem]:grid @[44rem]:grid-cols-[2fr_1fr_1fr_72px_1.6fr_40px]">
            <span>Medicine</span><span>Dose</span><span>Frequency</span><span>Days</span><span>Instructions</span><span />
          </div>
          <div className="flex flex-col gap-3">
            {meds.map((m, i) => (
              <div key={i} className="relative grid animate-pop-in grid-cols-2 gap-2 rounded-xl border border-line p-3 pt-9 @[44rem]:grid-cols-[2fr_1fr_1fr_72px_1.6fr_40px] @[44rem]:items-center @[44rem]:border-0 @[44rem]:p-0 @[44rem]:pt-0">
                <span className="absolute top-2.5 left-3 text-xs font-semibold text-muted uppercase @[44rem]:hidden">Medicine {i + 1}</span>
                <Field label="Medicine" wide>
                  <input aria-label={`Medicine ${i + 1} name`} className="input" placeholder="e.g. Paracetamol" value={m.medicine} onChange={(e) => setMed(i, "medicine", e.target.value)} />
                </Field>
                <Field label="Dose">
                  <input aria-label={`Medicine ${i + 1} dose`} className="input" placeholder="500 mg" value={m.dose} onChange={(e) => setMed(i, "dose", e.target.value)} />
                </Field>
                <Field label="Frequency">
                  <input aria-label={`Medicine ${i + 1} frequency (morning-afternoon-night)`} className="input" placeholder="1-0-1" value={m.frequency} onChange={(e) => setMed(i, "frequency", e.target.value)} />
                </Field>
                <Field label="Days">
                  <input aria-label={`Medicine ${i + 1} number of days`} type="number" min={1} className="input" value={m.days} onChange={(e) => setMed(i, "days", e.target.value)} />
                </Field>
                <Field label="Instructions">
                  <input aria-label={`Medicine ${i + 1} instructions`} className="input" placeholder="after food" value={m.instructions} onChange={(e) => setMed(i, "instructions", e.target.value)} />
                </Field>
                <button
                  type="button"
                  aria-label={`Remove medicine ${i + 1}`}
                  title="Remove"
                  disabled={meds.length === 1}
                  onClick={() => setMeds(meds.filter((_, j) => j !== i))}
                  className="absolute top-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-[transform,background-color,color] duration-300 ease-(--ease-spring) hover:bg-red-50 hover:text-danger active:scale-90 disabled:opacity-30 @[44rem]:static @[44rem]:h-11 @[44rem]:w-10"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">Drug interaction and allergy checks (openFDA / RxNorm) arrive in Phase 2.</p>
        </section>
      </div>

      <aside className="card h-fit">
        <h3 className="mb-1 font-semibold">Past visits</h3>
        {history.length === 0 && <Empty>First visit.</Empty>}
        {history.map((c) => (
          <div key={c._id} className="border-t border-line py-3 text-sm">
            <b>{new Date(c.createdAt).toLocaleDateString()}</b> · {c.diagnosis}
            <div className="text-muted">{c.doctor.name}</div>
            {c.prescription?.items.map((m, i) => <div key={i} className="text-muted">{m.medicine} {m.dose}</div>)}
          </div>
        ))}
      </aside>
    </div>
  );
}

/** A prescription field: its own small label on narrow screens, the column heading on wide ones. */
function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${wide ? "col-span-2 @[44rem]:col-span-1" : ""}`}>
      <span className="text-xs font-medium text-muted @[44rem]:hidden">{label}</span>
      {children}
    </label>
  );
}
