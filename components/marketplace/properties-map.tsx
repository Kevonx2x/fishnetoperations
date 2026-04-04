"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export function PropertiesMap({
  properties,
  onSelectProperty,
}: {
  properties: Array<{
    id: string;
    location: string;
    price: string;
    lat: number | null;
    lng: number | null;
  }>;
  onSelectProperty: (id: string) => void;
}) {
  const pts = useMemo(
    () =>
      (properties ?? []).filter(
        (p) =>
          typeof p.lat === "number" &&
          Number.isFinite(p.lat) &&
          typeof p.lng === "number" &&
          Number.isFinite(p.lng),
      ) as Array<{
        id: string;
        location: string;
        price: string;
        lat: number;
        lng: number;
      }>,
    [properties],
  );

  const center = useMemo(() => {
    if (pts.length) return [pts[0]!.lat, pts[0]!.lng] as [number, number];
    return [14.52, 121.05] as [number, number];
  }, [pts]);

  const icon = useMemo(
    () =>
      L.divIcon({
        className: "",
        html: `<div style="
          width: 26px; height: 26px; border-radius: 9999px;
          background: rgba(124,154,126,0.95);
          border: 2px solid rgba(255,255,255,0.95);
          box-shadow: 0 10px 22px rgba(0,0,0,0.18);
          display:flex; align-items:center; justify-content:center;
          color: white; font-weight: 800; font-size: 12px;
        ">F</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        popupAnchor: [0, -10],
      }),
    [],
  );

  // Leaflet needs window; make sure it's mounted
  useEffect(() => {}, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm">
      <div className="h-[340px] w-full">
        <MapContainer
          center={center}
          zoom={12}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitToPoints points={pts.map((p) => [p.lat, p.lng] as [number, number])} />

          {pts.map((p) => (
            <Marker
              key={p.id}
              position={[p.lat, p.lng]}
              icon={icon}
              eventHandlers={{
                click: () => onSelectProperty(p.id),
              }}
            >
              <Popup>
                <div className="min-w-[180px]">
                  <div className="font-serif text-base font-bold">{p.price}</div>
                  <div className="mt-1 text-sm">{p.location}</div>
                  <button
                    type="button"
                    onClick={() => onSelectProperty(p.id)}
                    className="mt-2 rounded-full bg-[#6B9E6E] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    View
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

function FitToPoints({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0]!, 13, { animate: true });
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => L.latLng(p[0], p[1])));
    map.fitBounds(bounds.pad(0.18), { animate: true });
  }, [map, points]);
  return null;
}

