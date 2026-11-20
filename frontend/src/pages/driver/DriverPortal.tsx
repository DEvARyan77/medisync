import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { usePolling } from "../../hooks/usePolling";
import { AmbulanceMap, MapPoint } from "../../components/AmbulanceMap";
import { Empty, ErrorText, PageTitle, StatusPill } from "../../components/ui";
import type { Trip, TripStatus } from "../../types";

const nextAction: Partial<Record<TripStatus, { status: TripStatus; label: string }>> = {
  accepted: { status: "arrived", label: "Arrived at pickup" },
  arrived: { status: "on_board", label: "Patient on board" },
  on_board: { status: "completed", label: "Reached hospital" },
};

export default function DriverPortal() {
  const { user } = useAuth();
  const [available, setAvailable] = useState(user?.isAvailable ?? true);
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState("");
  const [error, setError] = useState("");
  const lastSent = useRef(0);

  const current = usePolling(async () => (await api.get("/ambulance/current")).data.trip as Trip | null, 5000);
  const open = usePolling(async () => (await api.get("/ambulance/open")).data.trips as Trip[], 5000);

  // Share GPS while on duty or on a trip (sent at most every 5 s).
  const sharing = available || !!current.data;
  useEffect(() => {
    if (!sharing || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyPos(p);
        setGpsError("");
        if (Date.now() - lastSent.current > 5000) {
          lastSent.current = Date.now();
          api.patch("/ambulance/location", p).catch(() => {});
        }
      },
      () => setGpsError("Turn on location access so patients can see your ambulance."),
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [sharing]);

  async function toggle() {
    const r = await api.patch("/ambulance/availability", { isAvailable: !available });
    setAvailable(r.data.isAvailable);
  }

  async function act(fn: () => Promise<unknown>) {
    setError("");
    try {
      await fn();
      current.refresh();
      open.refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const trip = current.data;
  const points: MapPoint[] = [];
  if (myPos) points.push({ id: "me", ...myPos, label: "You", kind: "assigned" });
  if (trip?.pickupLocation) points.push({ id: "pickup", ...trip.pickupLocation, label: `Pickup: ${trip.pickupAddress}`, kind: "patient" });

  return (
    <>
      <PageTitle
        action={
          <label className="flex h-11 items-center gap-3 rounded-full border border-line bg-white px-4 font-semibold">
            <input type="checkbox" checked={available} onChange={toggle} disabled={!!trip} /> Available for trips
          </label>
        }
      >
        Hello, {user?.name}
      </PageTitle>
      <p className="-mt-4 mb-6 text-sm text-muted">Vehicle {user?.vehicleNumber} · {user?.vehicleType === "advanced" ? "Advanced life support" : "Basic life support"}</p>
      <ErrorText message={error || gpsError} />

      <div className="mt-2 grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <section className="card flex flex-col gap-3">
          <h2 className="text-lg font-semibold">New requests</h2>
          {trip && <p className="text-sm text-muted">Finish your current trip to accept a new one.</p>}
          {!open.data?.length && <Empty>No open requests.</Empty>}
          {open.data?.map((t) => (
            <div key={t._id} className={`flex flex-col gap-2 rounded-xl border p-4 ${t.type === "emergency" ? "border-2 border-danger" : "border-line"}`}>
              <div className="flex flex-wrap justify-between gap-2">
                <b className="capitalize">{t.type} · {t.patient.name}</b>
                <span className="text-xs text-muted">{new Date(t.createdAt).toLocaleTimeString()}</span>
              </div>
              <div className="text-sm text-muted">Pickup: {t.pickupAddress}{t.condition && ` · ${t.condition}`}</div>
              <button className="btn-primary self-start" disabled={!!trip} onClick={() => act(() => api.patch(`/ambulance/${t._id}/accept`))}>Accept</button>
            </div>
          ))}
        </section>

        <section className="card flex flex-col gap-4">
          {trip ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Current trip · {trip.patient.name}</h2>
                <div className="flex items-center gap-3"><StatusPill status={trip.status} /><a className="font-semibold text-brand" href={`tel:${trip.contactPhone}`}>Call patient</a></div>
              </div>
              <AmbulanceMap points={points} height={320} route />
              <div className="text-sm"><b>Pickup:</b> {trip.pickupAddress} · <b>Drop:</b> {trip.dropAddress}</div>
              {trip.pickupLocation && (
                <a className="text-sm font-semibold text-brand" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${trip.pickupLocation.lat},${trip.pickupLocation.lng}`}>
                  Open navigation
                </a>
              )}
              {nextAction[trip.status] && (
                <button className="btn-primary h-12" onClick={() => act(() => api.patch(`/ambulance/${trip._id}/status`, { status: nextAction[trip.status]!.status }))}>
                  {nextAction[trip.status]!.label}
                </button>
              )}
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold">No active trip</h2>
              <AmbulanceMap points={points} height={320} />
            </>
          )}
        </section>
      </div>
    </>
  );
}
