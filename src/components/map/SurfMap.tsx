"use client";

import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { RATING_HEX } from "@/components/forecast/rating-styles";
import type { SpotListItem } from "@/lib/forecast/selectors";
import { formatSurfRange } from "@/lib/format";

const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Bounds covering every configured spot from Cornwall to Thurso. */
const UK_BOUNDS: [[number, number], [number, number]] = [
  [49.8, -8.4],
  [59.0, 1.9],
];

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

export interface SurfMapProps {
  spots: SpotListItem[];
  dateKey: string;
}

/**
 * Interactive Leaflet map. Markers are coloured by rating and show the
 * maximum surf height; selecting one opens a popup with the forecast summary
 * and a link to the full spot forecast.
 */
export default function SurfMap({ spots, dateKey }: SurfMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current, { scrollWheelZoom: false, zoomSnap: 0.25, attributionControl: true });
      map.fitBounds(UK_BOUNDS);
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 14, detectRetina: true }).addTo(map);
      map.on("focus", () => map.scrollWheelZoom.enable());
      map.on("blur", () => map.scrollWheelZoom.disable());
      // Route popup links through the Next router (respects basePath, keeps it an SPA navigation).
      map.on("popupopen", (event) => {
        const link = event.popup.getElement()?.querySelector<HTMLAnchorElement>("a[data-path]");
        link?.addEventListener("click", (clickEvent) => {
          clickEvent.preventDefault();
          router.push(link.dataset.path!);
        });
      });
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      renderMarkers();
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    renderMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots, dateKey]);

  function renderMarkers() {
    const L = leafletRef.current;
    const layer = layerRef.current;
    if (!L || !layer) return;
    layer.clearLayers();
    for (const spot of spots) {
      const day = spot.days[dateKey];
      const colour = day ? RATING_HEX[day.rating] : "#94a3b8";
      const label = day ? (day.surfMaxFt > 0 ? String(day.surfMaxFt) : "–") : "?";
      const icon = L.divIcon({
        className: "",
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -16],
        html: `<span style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9999px;background:${colour};color:white;font:600 12px/1 system-ui,sans-serif;border:2.5px solid rgba(255,255,255,.9);box-shadow:0 4px 14px rgba(4,18,31,.35)">${label}</span>`,
      });
      const stars = day ? "★".repeat(day.rating) + "☆".repeat(5 - day.rating) : "";
      const popup = `
        <div style="min-width:190px;font:14px/1.4 system-ui,sans-serif">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;opacity:.65">${escapeHtml(spot.regionName)}</div>
          <div style="font-weight:600;font-size:15px">${escapeHtml(spot.name)}</div>
          ${
            day
              ? `<div style="margin-top:4px"><span style="color:${colour};font-size:15px">${stars}</span> <strong>${escapeHtml(day.label)}</strong></div>
                 <div style="font-size:20px;font-weight:700;margin-top:2px">${formatSurfRange(day.surfMinFt, day.surfMaxFt)}</div>
                 <div style="opacity:.8;margin-top:2px">${escapeHtml(day.headline)}</div>`
              : `<div style="opacity:.7;margin-top:4px">Forecast unavailable</div>`
          }
          <a href="${escapeHtml(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${spot.path}`)}" data-path="${escapeHtml(spot.path)}" style="display:inline-block;margin-top:8px;font-weight:600;color:#0888b2">View forecast →</a>
        </div>`;
      L.marker([spot.lat, spot.lon], { icon, title: spot.name, alt: `${spot.name} surf forecast`, keyboard: true })
        .bindPopup(popup)
        .addTo(layer);
    }
  }

  return <div ref={containerRef} className="h-full w-full" role="region" aria-label="Map of UK surf spots" />;
}
