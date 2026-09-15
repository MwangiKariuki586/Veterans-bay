"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import nairobiGeoJson from "@/data/nairobi-service-areas.json";

type Props = {
  serviceAreas: string[];
  className?: string;
};

const TILE_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>';

function filterGeoJson(serviceAreas: string[]) {
  if (!serviceAreas.length) return null;
  const wanted = new Set(serviceAreas.map((v) => v.toLowerCase()));
  const features = (nairobiGeoJson as GeoJSON.FeatureCollection).features.filter((f) =>
    wanted.has(String((f.properties as { name: string })?.name).toLowerCase()),
  );
  if (features.length === 0) return null;
  return {
    type: "FeatureCollection" as const,
    features,
  } as GeoJSON.FeatureCollection;
}

export function ServiceAreasMap({ serviceAreas, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const [failed, setFailed] = useState(false);
  const hasAreas = serviceAreas.length > 0;
  const filtered = hasAreas ? filterGeoJson(serviceAreas) : null;

  useEffect(() => {
    let cancelled = false;
    let map: import("leaflet").Map | null = null;

    async function init() {
      try {
        const L = await import("leaflet");
        // CSS must be imported on client; dynamic so it is not evaluated during SSR
        await import("leaflet/dist/leaflet.css");
        // Fix default icon paths for Next.js bundler
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });

        if (cancelled || !containerRef.current) return;

        const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        map = L.map(containerRef.current, {
          zoomControl: false,
          attributionControl: true,
          zoomSnap: 0.5,
          zoomDelta: 0.5,
          wheelDebounceTime: 40,
          fadeAnimation: !prefersReduced,
          zoomAnimation: !prefersReduced,
          markerZoomAnimation: !prefersReduced,
        });

        mapRef.current = map;

        L.tileLayer(TILE_URL, {
          attribution: TILE_ATTRIBUTION,
          maxZoom: 18,
          minZoom: 5,
          subdomains: "abcd",
        })
          .on("tileerror", () => setFailed(true))
          .addTo(map);

        // Controls
        L.control.zoom({ position: "bottomleft" }).addTo(map);
        // attribution already added via tileLayer; ensure font
        const attrib = document.querySelector(".leaflet-control-attribution") as HTMLElement | null;
        if (attrib) {
          attrib.style.fontSize = "0.65rem";
          attrib.style.background = "rgba(255,255,255,0.82)";
          attrib.style.backdropFilter = "blur(4px)";
          attrib.style.padding = "0 4px";
        }

        if (filtered) {
          const geoLayer = L.geoJSON(filtered as GeoJSON.GeoJsonObject, {
            style: (feature) => {
              const p = feature?.properties as { fill?: string; fillStroke?: string; fillOpacity?: number } | undefined;
              return {
                color: p?.fillStroke ?? "#256b34",
                weight: 1.5,
                fillColor: p?.fill ?? "#e8f6eb",
                fillOpacity: p?.fillOpacity ?? 0.52,
              };
            },
            onEachFeature: (feature, layer) => {
              const name = (feature.properties as { label?: string; name?: string })?.label ?? (feature.properties as { name?: string })?.name ?? "";
              if (name) layer.bindTooltip(name, { sticky: true, className: "service-area-tooltip" });
            },
          }).addTo(map);
          try {
            map.fitBounds(geoLayer.getBounds().pad(0.22));
          } catch {
            map.setView([-1.286, 36.817], 11);
          }
        } else if (hasAreas) {
          // Areas requested but no matching polygons — center on Nairobi county bbox
          map.setView([-1.286, 36.817], 10);
        } else {
          map.setView([-1.286, 36.817], 11);
        }

        // Nairobi county faint outline always for context
        const nairobiFeature = (nairobiGeoJson as GeoJSON.FeatureCollection).features.find(
          (f) => (f.properties as { name?: string })?.name === "Nairobi",
        );
        if (nairobiFeature) {
          L.geoJSON(nairobiFeature as GeoJSON.GeoJsonObject, {
            style: { color: "#c8d7a0", weight: 1, fillColor: "#f4f8e8", fillOpacity: 0.04, dashArray: "4 4" },
            interactive: false,
          }).addTo(map);
        }

        setTimeout(() => map?.invalidateSize(), 80);
        const onResize = () => map?.invalidateSize();
        window.addEventListener("resize", onResize);
        // store cleanup
        (map as unknown as { _onResize: () => void })._onResize = onResize;
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void init();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        const m = mapRef.current as unknown as { _onResize?: () => void };
        if (m._onResize) window.removeEventListener("resize", m._onResize);
        try {
          mapRef.current.remove();
        } catch {
          // ignore
        }
        mapRef.current = null;
      }
      if (map) {
        try {
          map.remove();
        } catch {
          // ignore
        }
      }
    };
  }, [hasAreas, filtered]);

  // Keep map in sync when filtered changes after mount (React strict double-effect)
  useEffect(() => {
    if (!mapRef.current || !filtered) return;
    // Re-render is handled by remount via key; no incremental update needed
  }, [filtered]);

  if (!hasAreas) return null;

  if (failed) {
    return (
      <div className={cn("rounded-lg border border-black/8 bg-muted p-3 text-xs text-muted-foreground", className)}>
        Map unavailable.{" "}
        <button
          type="button"
          className="underline"
          onClick={() => {
            const q = encodeURIComponent(serviceAreas.join(", "));
            window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank", "noreferrer");
            toast.info("Opened in Google Maps");
          }}
        >
          View on map
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={`Service areas map for ${serviceAreas.join(", ")}. Interactive map with coverage polygons.`}
      aria-busy={!filtered && hasAreas}
      className={cn(
        "h-[220px] w-full overflow-hidden rounded-lg border border-black/8 bg-muted [--leaflet-attribution:0.65rem]",
        "[&_.leaflet-container]:h-full [&_.leaflet-container]:w-full [&_.leaflet-container]:font-sans",
        "[&_.leaflet-tile-pane]:saturate-[0.85] [&_.leaflet-tile-pane]:contrast-[0.98]",
        className,
      )}
      tabIndex={0}
    />
  );
}
