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
          <button key={t} onClick={() => { setTab(t); setSelectedId(null); }} className={`rounded-full px-4 py-2 text-sm font-semibold capitalize ${tab === t ? "bg-brand text-white" : "border border-line bg-white"}`}>
            {t === "pending" ? "To dispense" : "Dispensed"}
          </button>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="card flex flex-col gap-2 p-4">
          {list.data?.map((p) => (
            <button key={p._id} onClick={() => setSelectedId(p._id)} className={`rounded-lg border p-3 text-left ${selected?._id === p._id ? "border-2 border-brand bg-brand-soft" : "border-line"}`}>
              <div className="font-semibold">{p.patient.name}</div>
              <div className="text-sm text-muted">{p.doctor.name} · {p.items.length} items · {new Date(p.createdAt).toLocaleTimeString()}</div>
            </button>
          ))}
          {!list.data?.length && <Empty>Nothing here.</Empty>}
        </aside>

        {selected && (
          <section className="card">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{selected.patient.name}</h2>
                <p className="text-sm text-muted">Allergies: {selected.patient.allergies?.join(", ") || "none recorded"}</p>
              </div>
              <StatusPill status={selected.status} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
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
              <div className="mt-4 flex justify-end"><button className="btn-primary" onClick={() => dispense(selected._id)}>Mark dispensed</button></div>
            )}
          </section>
        )}
      </div>
    </>
  );
}
