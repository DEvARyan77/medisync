import { FormEvent, useEffect, useState } from "react";
import { api, errorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { usePolling } from "../../hooks/usePolling";
import { AmbulanceMap, MapPoint, getCurrentPosition } from "../../components/AmbulanceMap";
import { ErrorText, PageTitle, StatusPill } from "../../components/ui";
import type { Trip } from "../../types";

interface Nearby {
  driverId: string;
  name: string;
  vehicleNumber: string;
  vehicleType: string;
  lat: number;
  lng: number;
  distanceKm: number;
  etaMin: number;
}

const steps = ["requested", "accepted", "arrived", "on_board", "completed"] as const;
const stepLabels: Record<string, string> = {
  requested: "Requested",
  accepted: "Driver accepted",
  arrived: "Arrived at pickup",
  on_board: "Patient on board",
  completed: "Reached hospital",
};

export default function PatientAmbulance() {
  const { user } = useAuth();
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState("");

  useEffect(() => {
    getCurrentPosition().then(setMe).catch((e) => setGpsError(e.message));
  }, []);

  // My active trip (refreshes every 5 s so the ambulance moves on the map).
  const trip = usePolling(async () => (await api.get("/ambulance/mine")).data.active as Trip | null, 5000);

  // Nearby available ambulances (only while I have no active trip).
  const nearby = usePolling(
    async () => {
      if (!me || trip.data) return [] as Nearby[];
      return (await api.get("/ambulance/nearby", { params: me })).data.ambulances as Nearby[];
    },
    10000,
    [me, trip.data?._id]
  );

  const active = trip.data;
  const points: MapPoint[] = [];
  if (active) {
    const pickup = active.pickupLocation ?? me;
    if (pickup) points.push({ id: "me", ...pickup, label: "Pickup point", kind: "patient" });
    if (active.driverLocation) {
      points.push({ id: "amb", lat: active.driverLocation.lat, lng: active.driverLocation.lng, label: `${active.driver?.name} · ${active.driver?.vehicleNumber}`, kind: "assigned" });
    }
  } else {
    if (me) points.push({ id: "me", ...me, label: "You are here", kind: "patient" });
    nearby.data?.forEach((a) =>
      points.push({ id: a.driverId, lat: a.lat, lng: a.lng, label: `${a.vehicleNumber} · ${a.distanceKm} km · ~${a.etaMin} min`, kind: "ambulance" })
    );
  }

  return (
    <>
      <PageTitle>{active ? "Your ambulance" : "Request an ambulance"}</PageTitle>
      <div className="grid gap-6 lg:grid-cols-2">
        {active ? <LiveTrip trip={active} onChange={trip.refresh} /> : <RequestForm me={me} phone={user?.phone ?? ""} onDone={trip.refresh} />}

        <section className="card flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{active ? "Live location" : "Ambulances near you"}</h2>
            {!active && <span className="text-sm text-muted">{nearby.data?.length ?? 0} available</span>}
          </div>
          <AmbulanceMap points={points} height={360} route={!!active} />
          <ErrorText message={gpsError && `${gpsError}. Allow location access to see nearby ambulances.`} />
          {!active && (
            <ul className="divide-y divide-line text-sm">
              {nearby.data?.map((a) => (
                <li key={a.driverId} className="flex justify-between py-2">
                  <span><b>{a.vehicleNumber}</b> · {a.vehicleType === "advanced" ? "Advanced life support" : "Basic"}</span>
                  <span className="text-muted">{a.distanceKm} km · ~{a.etaMin} min</span>
                </li>
              ))}
              {me && nearby.data?.length === 0 && <li className="py-2 text-muted">No ambulances available within 15 km right now.</li>}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function RequestForm({ me, phone, onDone }: { me: { lat: number; lng: number } | null; phone: string; onDone: () => void }) {
  const [form, setForm] = useState({ type: "emergency", pickupAddress: "", condition: "", contactPhone: phone });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/ambulance", { ...form, pickupLocation: me ?? undefined });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-4">
      <div>
        <label className="label" htmlFor="addr">Pickup address</label>
        <input id="addr" className="input" placeholder="House no., street, landmark" value={form.pickupAddress} onChange={(e) => setForm({ ...form, pickupAddress: e.target.value })} required />
        <p className="mt-1 text-xs text-muted">{me ? "Your GPS location will be shared with the driver." : "Waiting for GPS…"}</p>
      </div>
      <fieldset>
        <legend className="label">Type</legend>
        <div className="flex flex-wrap gap-3">
          {[["emergency", "Emergency"], ["transfer", "Non-emergency transfer"]].map(([v, l]) => (
            <label key={v} className={`flex h-11 items-center gap-2 rounded-lg border px-4 ${form.type === v ? "border-2 border-danger bg-red-50 font-semibold" : "border-line"}`}>
              <input type="radio" name="type" checked={form.type === v} onChange={() => setForm({ ...form, type: v })} /> {l}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="label" htmlFor="cond">Patient condition (optional)</label>
        <textarea id="cond" rows={3} className="w-full rounded-lg border border-line p-3" placeholder="e.g. chest pain, conscious" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} />
      </div>
      <div>
        <label className="label" htmlFor="ph">Contact number</label>
        <input id="ph" className="input" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} required />
      </div>
      <ErrorText message={error} />
      <button className="btn-danger h-13 text-lg" disabled={busy}>{busy ? "Sending…" : "Request ambulance now"}</button>
    </form>
  );
}

function LiveTrip({ trip, onChange }: { trip: Trip; onChange: () => void }) {
  const reached = new Set(trip.timeline.map((t) => t.status));
  const timeOf = (s: string) => trip.timeline.find((t) => t.status === s)?.at;

  async function cancel() {
    if (!confirm("Cancel this ambulance request?")) return;
    await api.patch(`/ambulance/${trip._id}/status`, { status: "cancelled" });
    onChange();
  }

  return (
    <section className="card flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Trip status</h2>
        <StatusPill status={trip.status} />
      </div>
      {trip.driver ? (
        <div className="grid grid-cols-2 gap-3">
          <div><div className="text-xs text-muted uppercase">Driver</div><div className="font-semibold">{trip.driver.name}</div></div>
          <div><div className="text-xs text-muted uppercase">Vehicle</div><div className="font-semibold">{trip.driver.vehicleNumber}</div></div>
          <div><div className="text-xs text-muted uppercase">Call</div><a className="font-semibold text-brand" href={`tel:${trip.driver.phone}`}>{trip.driver.phone}</a></div>
        </div>
      ) : (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Finding the nearest available ambulance…</p>
      )}
      <ol className="flex flex-col gap-2 border-l-2 border-line pl-4 text-sm">
        {steps.map((s) => (
          <li key={s} className={reached.has(s) ? "font-semibold" : "text-muted"}>
            {stepLabels[s]} {timeOf(s) && <span className="font-normal text-muted">· {new Date(timeOf(s)!).toLocaleTimeString()}</span>}
          </li>
        ))}
      </ol>
      {["requested", "accepted"].includes(trip.status) && <button className="btn-ghost" onClick={cancel}>Cancel request</button>}
    </section>
  );
}
