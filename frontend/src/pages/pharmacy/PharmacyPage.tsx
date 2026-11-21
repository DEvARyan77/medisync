import { useState } from "react";
import { api, errorMessage } from "../../api/client";
import { usePolling } from "../../hooks/usePolling";
import { Empty, ErrorText, PageTitle, StatusPill } from "../../components/ui";
import type { Prescription } from "../../types";

// Phase 2 adds inventory, generic alternatives and billing here.
export default function PharmacyPage() {
  const [tab, setTab] = useState<"pending" | "dispensed">("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const list = usePolling(async () => (await api.get("/prescriptions", { params: { status: tab } })).data.prescriptions as Prescription[], 8000, [tab]);

  const selected = list.data?.find((p) => p._id === selectedId) ?? list.data?.[0];

  async function dispense(id: string) {
    setError("");
    try {
      await api.patch(`/prescriptions/${id}/dispense`);
      setSelectedId(null);
      list.refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      <PageTitle>Pharmacy</PageTitle>
      <div className="mb-4 flex gap-2">
        {(["pending", "dispensed"] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setSelectedId(null); }} className={`rounded-full px-4 py-2 text-sm font-semibold transition-[transform,background-color] duration-300 ease-(--ease-spring) active:scale-90 ${tab === t ? "bg-brand text-white" : "border border-line bg-white"}`}>
            {t === "pending" ? "To dispense" : "Dispensed"}
          </button>
        ))}
      </div>
      {/* items-start: each card is only as tall as its content; the list scrolls inside its own box */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="stagger card flex max-h-80 flex-col gap-2 overflow-y-auto overscroll-contain p-3 sm:p-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-11rem)]">
          {list.data?.map((p) => (
            <button key={p._id} onClick={() => setSelectedId(p._id)} className={`rounded-lg border p-3 text-left transition-[transform,background-color,border-color] duration-300 ease-(--ease-spring) hover:translate-x-1 active:scale-95 ${selected?._id === p._id ? "border-2 border-brand bg-brand-soft" : "border-line"}`}>
              <div className="font-semibold">{p.patient.name}</div>
              <div className="text-sm text-muted">{p.doctor.name} · {p.items.length} items · {new Date(p.createdAt).toLocaleTimeString()}</div>
            </button>
          ))}
          {!list.data?.length && <Empty>Nothing here.</Empty>}
        </aside>

        {selected && (
          <section key={selected._id} className="card h-fit animate-pop-in">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{selected.patient.name}</h2>
                <p className="text-sm text-muted">Allergies: {selected.patient.allergies?.join(", ") || "none recorded"}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill status={selected.status} />
                {selected.status === "dispensed" && (
                <button type="button" className="btn-ghost h-9 px-3 text-sm" onClick={() => printPrescription(selected)} title="Print this prescription">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v7H6z" />
                  </svg>
                  Print
                </button>
                )}
              </div>
            </div>
            {/* Phones: stacked medicine cards */}
            <ul className="stagger flex flex-col gap-2 sm:hidden">
              {selected.items.map((m, i) => (
                <li key={i} className="rounded-lg bg-page p-3 text-sm">
                  <div className="font-semibold">{m.medicine} <span className="font-normal">{m.dose}</span></div>
                  <div className="text-muted">{m.frequency} · {m.days} days{m.instructions && ` · ${m.instructions}`}</div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="text-xs text-muted uppercase"><tr><th className="py-2">Medicine</th><th>Dose</th><th>Frequency</th><th>Days</th><th>Instructions</th></tr></thead>
                <tbody>
                  {selected.items.map((m, i) => (
                    <tr key={i} className="border-t border-line"><td className="py-3 font-semibold">{m.medicine}</td><td>{m.dose}</td><td>{m.frequency}</td><td>{m.days}</td><td>{m.instructions}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ErrorText message={error} />
            {selected.status === "pending" && (
              <div className="mt-4 flex justify-end"><button className="btn-primary w-full sm:w-auto" onClick={() => dispense(selected._id)}>Mark dispensed</button></div>
            )}
          </section>
        )}
      </div>
    </>
  );
}

const esc = (t: unknown) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Prints a clean, one-page prescription (clinic header, patient, doctor, medicines) via a hidden frame. */
function printPrescription(p: Prescription) {
  const date = new Date(p.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const rows = p.items
    .map((m, i) => `<tr><td>${i + 1}</td><td><b>${esc(m.medicine)}</b></td><td>${esc(m.dose)}</td><td>${esc(m.frequency)}</td><td>${esc(m.days)} days</td><td>${esc(m.instructions)}</td></tr>`)
    .join("");
  const html = `<!doctype html><html><head><title>Prescription · ${esc(p.patient.name)}</title><style>
    *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#1f2328;margin:32px}
    header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #0f766e;padding-bottom:12px}
    h1{margin:0;color:#0f766e;font-size:26px} .muted{color:#5a6270;font-size:13px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin:18px 0;font-size:14px}
    table{width:100%;border-collapse:collapse;font-size:14px;margin-top:8px} th{text-align:left;font-size:12px;text-transform:uppercase;color:#5a6270;border-bottom:1px solid #d0d4da;padding:8px 6px}
    td{border-bottom:1px solid #eceef1;padding:9px 6px;vertical-align:top} .rx{font-size:30px;font-weight:bold;color:#0f766e;margin-top:14px}
    .allergy{background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:8px 10px;font-size:13px;margin-top:6px}
    footer{margin-top:48px;display:flex;justify-content:space-between;font-size:13px} .sign{border-top:1px solid #1f2328;padding-top:6px;width:220px;text-align:center}
    @page{margin:14mm}
  </style></head><body>
    <header><div><h1>MediSync</h1><div class="muted">OPD Pharmacy</div></div><div class="muted">${esc(date)}</div></header>
    <div class="grid">
      <div><span class="muted">Patient</span><br><b>${esc(p.patient.name)}</b></div>
      <div><span class="muted">Doctor</span><br><b>${esc(p.doctor.name)}</b></div>
      <div><span class="muted">Status</span><br>Dispensed</div>
      <div><span class="muted">Prescription ID</span><br>${esc(p._id.slice(-8).toUpperCase())}</div>
    </div>
    <div class="allergy"><b>Allergies:</b> ${esc(p.patient.allergies?.join(", ") || "none recorded")}</div>
    <div class="rx">℞</div>
    <table><thead><tr><th>#</th><th>Medicine</th><th>Dose</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="muted" style="margin-top:10px">Frequency is morning-afternoon-night (1-0-1 = morning and night).</p>
    <footer><span class="muted">Printed from MediSync</span><span class="sign">Pharmacist's signature</span></footer>
  </body></html>`;

  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentWindow!.document;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    frame.contentWindow!.focus();
    frame.contentWindow!.print();
    setTimeout(() => frame.remove(), 1000);
  }, 250);
}
