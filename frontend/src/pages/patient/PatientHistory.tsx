import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { usePolling } from "../../hooks/usePolling";
import { Empty, PageTitle, StatusPill } from "../../components/ui";
import type { Consultation } from "../../types";

// Phase 3 turns this into a FHIR timeline that also pulls records from other hospitals.
export default function PatientHistory() {
  const { user } = useAuth();
  const { data } = usePolling(async () => {
    const r = await api.get(`/consultations/patient/${user!._id}`);
    return r.data.consultations as Consultation[];
  }, 60000);

  return (
    <>
      <PageTitle>Health timeline</PageTitle>
      <div className="card">
        {!data?.length && <Empty>No visits yet.</Empty>}
        <ol className="divide-y divide-line">
          {data?.map((c) => (
            <li key={c._id} className="flex flex-col gap-2 py-4 md:flex-row md:gap-6">
              <div className="w-32 shrink-0 text-sm text-muted">{new Date(c.createdAt).toLocaleDateString()}</div>
              <div className="flex-1">
                <div className="font-semibold">{c.diagnosis}</div>
                <div className="text-sm text-muted">{c.doctor.name} · {c.doctor.department} · {c.chiefComplaint}</div>
                {c.prescription && (
                  <div className="mt-2 rounded-lg bg-page p-3 text-sm">
                    <div className="mb-1 flex items-center gap-2 font-semibold">Prescription <StatusPill status={c.prescription.status} /></div>
                    {c.prescription.items.map((m, i) => (
                      <div key={i}>{m.medicine} {m.dose} · {m.frequency} · {m.days} days {m.instructions && `· ${m.instructions}`}</div>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
