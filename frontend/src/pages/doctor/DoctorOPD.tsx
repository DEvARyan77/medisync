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

  const waiting = (queue.data ?? []).filter((a) => ["checked_in", "in_consultation"].includes(a.status));
  const done = (queue.data ?? []).filter((a) => a.status === "completed");
  const selected = waiting.find((a) => a._id === selectedId) ?? null;

  return (
    <>
      <PageTitle>My OPD · today</PageTitle>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="card flex flex-col gap-2 p-4">
          <h2 className="px-2 text-xs font-semibold text-muted uppercase">Queue ({waiting.length})</h2>
          {waiting.map((a) => (
            <button
              key={a._id}
              onClick={() => setSelectedId(a._id)}
              className={`flex items-center justify-between rounded-lg px-3 py-3 text-left ${selectedId === a._id ? "bg-brand-soft font-semibold text-brand" : "hover:bg-page"}`}
            >
              <span>{a.token} · {a.patient.name}</span>
              <StatusPill status={a.status} />
            </button>
          ))}
          {waiting.length === 0 && <Empty>No patients waiting.</Empty>}
          {done.length > 0 && <p className="mt-4 px-2 text-sm text-muted">Seen today: {done.length}</p>}
        </aside>

        {selected ? (
          <ConsultationForm
            key={selected._id}
            appointment={selected}
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

function ConsultationForm({ appointment, onDone }: { appointment: Appointment; onDone: () => void }) {
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
    // Move the patient into "in consultation" when the doctor opens them.
    if (appointment.status === "checked_in") api.patch(`/appointments/${appointment._id}/status`, { status: "in_consultation" }).catch(() => {});
  }, [p._id, appointment._id, appointment.status]);

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
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{p.name} <span className="font-normal text-muted">· {age(p.dateOfBirth)} {p.gender}</span></h2>
            <p className="text-sm text-muted">
              Token {appointment.token} · Allergies:{" "}
              <b className="text-amber-800">{p.allergies?.length ? p.allergies.join(", ") : "none recorded"}</b>
            </p>
          </div>
          <button className="btn-primary" disabled={busy || !chiefComplaint || !diagnosis} onClick={finish}>
            {busy ? "Saving…" : "Finish & send to pharmacy"}
          </button>
        </div>
        <ErrorText message={error} />

        <section className="card">
          <h3 className="mb-3 font-semibold">Vitals</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {([["bloodPressure", "BP", "120/80"], ["pulse", "Pulse", "72"], ["temperatureF", "Temp °F", "98.6"], ["weightKg", "Weight kg", "70"]] as const).map(([k, l, ph]) => (
              <div key={k}>
                <label className="label" htmlFor={k}>{l}</label>
                <input id={k} className="input" placeholder={ph} value={vitals[k]} onChange={(e) => setVitals({ ...vitals, [k]: e.target.value })} />
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

        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">e-Prescription</h3>
            <button className="btn-outline h-9 px-3 text-sm" onClick={() => setMeds([...meds, { ...emptyMed }])}>Add medicine</button>
          </div>
          <div className="flex flex-col gap-3">
            {meds.map((m, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 md:grid-cols-[2fr_1fr_1fr_80px_2fr_auto]">
                <input aria-label="Medicine" className="input" placeholder="Medicine" value={m.medicine} onChange={(e) => setMed(i, "medicine", e.target.value)} />
                <input aria-label="Dose" className="input" placeholder="500 mg" value={m.dose} onChange={(e) => setMed(i, "dose", e.target.value)} />
                <input aria-label="Frequency" className="input" placeholder="1-0-1" value={m.frequency} onChange={(e) => setMed(i, "frequency", e.target.value)} />
                <input aria-label="Days" type="number" min={1} className="input" value={m.days} onChange={(e) => setMed(i, "days", e.target.value)} />
                <input aria-label="Instructions" className="input" placeholder="after food" value={m.instructions} onChange={(e) => setMed(i, "instructions", e.target.value)} />
                <button aria-label="Remove medicine" className="text-sm text-danger" onClick={() => setMeds(meds.filter((_, j) => j !== i))}>Remove</button>
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
