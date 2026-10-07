import { useEffect, useRef, useState } from "react";
import type { DivIcon, Map as LeafletMap, Marker, TileLayer } from "leaflet";
import { Maximize2, Radar } from "lucide-react";

import { CAMPUS_CENTER, LOTS, type LotId, type Tone } from "@/lib/lots";
import { cn } from "@/lib/utils";

// Both basemaps work without an API key. The street map is standard
// OpenStreetMap, darkened with a CSS filter (.tiles-dark) to fit the theme.
type Basemap = "map" | "satellite";

const BASEMAPS: Record<
  Basemap,
  { label: string; url: string; attribution: string; dark: boolean }
> = {
  map: {
    label: "Map",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    dark: true,
  },
  satellite: {
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics",
    dark: false,
  },
};

const BASEMAP_KEY = "lotpulse:basemap";

function loadBasemap(): Basemap {
  try {
    return window.localStorage.getItem(BASEMAP_KEY) === "satellite" ? "satellite" : "map";
  } catch {
    return "map";
  }
}

type Leaflet = typeof import("leaflet");

interface CampusMapProps {
  selected: LotId;
  tones: Record<LotId, Tone>;
  onSelect: (lot: LotId) => void;
  onExpand?: () => void;
  expanded?: boolean;
}

function pinIcon(L: Leaflet, label: string, tone: Tone, selected: boolean): DivIcon {
  return L.divIcon({
    className: "map-pin-wrapper",
    html: `<span class="map-pin" data-tone="${tone}" data-selected="${selected}"><span class="map-pin-ring"></span>${label}</span>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

export function CampusMap({
  selected,
  tones,
  onSelect,
  onExpand,
  expanded = false,
}: CampusMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<Leaflet | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Partial<Record<LotId, Marker>>>({});
  const tileLayerRef = useRef<TileLayer | null>(null);
  const onSelectRef = useRef(onSelect);
  const [basemap, setBasemap] = useState<Basemap>(loadBasemap);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [tilesFailed, setTilesFailed] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Leaflet touches `window` on import, so load it on the client only.
  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;

    import("leaflet")
      .then((module) => {
        const L = (module.default ?? module) as Leaflet;
        const container = containerRef.current;
        if (cancelled || !container) return;
        leafletRef.current = L;

        const map = L.map(container, {
          center: [CAMPUS_CENTER.lat, CAMPUS_CENTER.lng],
          zoom: 16,
          zoomControl: false,
          // Fractional zoom lets fitBounds spread the pins as far as the box allows.
          zoomSnap: 0.25,
          attributionControl: true,
          scrollWheelZoom: expanded,
        });
        L.control.zoom({ position: "bottomright" }).addTo(map);
        map.attributionControl.setPrefix(false);

        for (const lot of LOTS) {
          const marker = L.marker([lot.position.lat, lot.position.lng], {
            icon: pinIcon(L, lot.short, "low", false),
            title: lot.name,
            alt: lot.name,
            keyboard: true,
            riseOnHover: true,
          })
            .on("click", () => onSelectRef.current(lot.id))
            .addTo(map);
          markersRef.current[lot.id] = marker;
        }

        map.fitBounds(L.latLngBounds(LOTS.map((lot) => [lot.position.lat, lot.position.lng])), {
          // Leave room for the header chip (top) and the style toggle and zoom (bottom).
          paddingTopLeft: [32, expanded ? 32 : 60],
          paddingBottomRight: [56, 60],
          maxZoom: 17.5,
        });

        // Dialogs and responsive layouts resize the container after mount.
        resizeObserver = new ResizeObserver(() => map.invalidateSize());
        resizeObserver.observe(container);

        mapRef.current = map;
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      markersRef.current = {};
    };
  }, [expanded]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (status !== "ready" || !L || !map) return;
    const config = BASEMAPS[basemap];
    let tileErrors = 0;
    setTilesFailed(false);
    const layer = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: 19,
      className: config.dark ? "tiles-dark" : "",
    })
      .on("tileerror", () => {
        tileErrors += 1;
        if (tileErrors >= 4) setTilesFailed(true);
      })
      .on("tileload", () => setTilesFailed(false))
      .addTo(map);
    tileLayerRef.current?.remove();
    tileLayerRef.current = layer;
    try {
      window.localStorage.setItem(BASEMAP_KEY, basemap);
    } catch {
      // Preference just won't persist.
    }
  }, [basemap, status]);

  useEffect(() => {
    const L = leafletRef.current;
    if (status !== "ready" || !L) return;
    for (const lot of LOTS) {
      const isSelected = lot.id === selected;
      const marker = markersRef.current[lot.id];
      marker?.setIcon(pinIcon(L, lot.short, tones[lot.id], isSelected));
      marker?.setZIndexOffset(isSelected ? 1000 : 0);
    }
    const lot = LOTS.find((item) => item.id === selected);
    if (lot) mapRef.current?.panTo([lot.position.lat, lot.position.lng], { animate: true });
  }, [selected, tones, status]);

  return (
    <section
      className={cn("campus-map", expanded && "campus-map-expanded")}
      aria-label="UTM campus map"
    >
      {!expanded && (
        <div className="campus-map-header">
          <span className="eyebrow">
            <Radar aria-hidden /> Campus radar
          </span>
          {onExpand && (
            <button
              type="button"
              className="icon-button"
              onClick={onExpand}
              aria-label="Expand campus map"
            >
              <Maximize2 aria-hidden />
            </button>
          )}
        </div>
      )}
      <div ref={containerRef} className="campus-map-canvas" />
      {status === "ready" && (
        <div className="basemap-toggle" role="group" aria-label="Map style">
          {(Object.keys(BASEMAPS) as Basemap[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={basemap === key}
              onClick={() => setBasemap(key)}
            >
              {BASEMAPS[key].label}
            </button>
          ))}
        </div>
      )}
      {status !== "ready" && (
        <div className="campus-map-overlay" role="status">
          <Radar className="campus-map-overlay-icon" aria-hidden />
          <span>{status === "loading" ? "Acquiring signal…" : "Map unavailable"}</span>
        </div>
      )}
      {status === "ready" && tilesFailed && (
        <p className="campus-map-note" role="status">
          Map tiles couldn't load. Lot pins still work.
        </p>
      )}
    </section>
  );
}
