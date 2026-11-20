import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
  kind: "patient" | "ambulance" | "assigned";
}

// Simple coloured dot markers (no image files needed).
const icon = (color: string, size = 18) =>
  L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 0 0 1px ${color}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

const icons = {
  patient: icon("#2563eb"), // you
  ambulance: icon("#b91c1c"), // available ambulance
  assigned: icon("#0f766e", 24), // your ambulance
};

// Keep every point in view as they move.
function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join("|");
  useEffect(() => {
    if (points.length === 1) map.setView([points[0].lat, points[0].lng], 14);
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [40, 40] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

export function AmbulanceMap({ points, height = 320, route = false }: { points: MapPoint[]; height?: number; route?: boolean }) {
  const center: [number, number] = points[0] ? [points[0].lat, points[0].lng] : [28.6139, 77.209]; // New Delhi
  return (
    <div className="overflow-hidden rounded-xl border border-line" style={{ height }}>
      <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={icons[p.kind]}>
            <Popup>{p.label}</Popup>
          </Marker>
        ))}
        {route && points.length === 2 && (
          <Polyline positions={points.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: "#0f766e", dashArray: "6 8" }} />
        )}
        <FitBounds points={points} />
      </MapContainer>
    </div>
  );
}

// Browser GPS as a promise.
export function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("This browser has no GPS support"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error("Location permission denied")),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}
