import { useEffect, useRef, useState } from "react";
import { Crosshair, Maximize2, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { campusCenter, lotPositions, type LotId } from "@/lib/campus-lots";

const TONE_COLORS: Record<string, string> = { high: "#f0554a", medium: "#f5a524", low: "#34d399" };
const SELECT_COLOR = "#5b9bff";

const DARK_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#12161f" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a93a6" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#12161f" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#232a38" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#161b26" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#6b7386" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0b1a26" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#14202a" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

let mapsPromise: Promise<void> | null = null;
function loadMaps(): Promise<void> {
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve, reject) => {
    const w = window as unknown as Record<string, any>;
    if (w.google?.maps) return resolve();
    const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
    const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"];
    if (!key) return reject(new Error("Google Maps browser key is not configured"));
    w.gm_authFailure = () => reject(new Error("Google Maps authorization failed"));
    w.__lotpulseMapsReady = () => resolve();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__lotpulseMapsReady&channel=${channel}`;
    script.async = true;
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });
  return mapsPromise;
}

function pinIcon(google: any, color: string, scale: number) {
  return {
    path: "M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z",
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#0b0e14",
    strokeWeight: 1.5,
    scale,
    anchor: new google.maps.Point(12, 22),
  };
}

export function CampusMap({ selected, onSelect, onExpand, expanded = false, tones }: { selected: string; onSelect: (lot: string) => void; onExpand?: () => void; expanded?: boolean; tones: Record<string, string> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const google = (window as unknown as Record<string, any>)["google"];
        const map = new google.maps.Map(containerRef.current, {
          center: campusCenter,
          zoom: 16,
          styles: DARK_STYLES,
          clickableIcons: false,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          backgroundColor: "#12161f",
        });
        mapRef.current = map;
        (Object.keys(lotPositions) as LotId[]).forEach((id) => {
          const marker = new google.maps.Marker({
            map,
            position: lotPositions[id],
            title: id,
            label: { text: id === "Inner Circle" ? "IC" : id, color: "#0b0e14", fontSize: "9px", fontWeight: "700" },
            icon: pinIcon(google, TONE_COLORS[tones[id]] ?? TONE_COLORS.low, 1.1),
          });
          marker.addListener("click", () => onSelect(id));
          markersRef.current[id] = marker;
        });
        setStatus("ready");
      })
      .catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status !== "ready") return;
    const google = (window as unknown as Record<string, any>)["google"];
    Object.entries(markersRef.current).forEach(([id, marker]) => {
      const isSelected = id === selected;
      marker.setIcon(pinIcon(google, isSelected ? SELECT_COLOR : TONE_COLORS[tones[id] ?? ""] ?? TONE_COLORS["low"], isSelected ? 1.5 : 1.1));
      marker.setZIndex(isSelected ? 10 : 1);
    });
    const position = lotPositions[selected as LotId];
    if (position && mapRef.current) mapRef.current.panTo(position);
  }, [selected, status, tones]);

  return (
    <section className={`campus-map ${expanded ? "map-expanded" : ""}`} aria-label="UTM campus map">
      <div className="map-heading">
        <span><Crosshair size={14} /> CAMPUS RADAR</span>
        {onExpand && <Button variant="ghost" size="icon" aria-label="Expand campus map" title="Expand campus map" onClick={onExpand}><Maximize2 /></Button>}
      </div>
      <div ref={containerRef} className="map-canvas" />
      {status === "loading" && <div className="map-overlay"><Radar className="map-overlay-icon" /><span>Acquiring signal…</span></div>}
      {status === "error" && <div className="map-overlay"><Radar className="map-overlay-icon" /><span>Map signal unavailable</span></div>}
      <div className="map-footer"><span className="status-dot" /> UTM · MISSISSAUGA <span>LIVE MAP</span></div>
    </section>
  );
}
