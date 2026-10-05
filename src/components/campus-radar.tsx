import { Crosshair, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CampusRadar({ selected, onSelect, onExpand, expanded = false }: { selected: string; onSelect: (lot: string) => void; onExpand?: () => void; expanded?: boolean }) {
  return (
    <section className={`campus-map ${expanded ? "map-expanded" : ""}`} aria-label="Illustrative UTM campus radar">
      <div className="map-heading"><span><Crosshair size={14} /> CAMPUS RADAR</span>{onExpand && <Button variant="ghost" size="icon" aria-label="Expand campus radar" title="Expand campus radar" onClick={onExpand}><Maximize2 /></Button>}</div>
      <svg viewBox="0 0 380 250" className="map-art" role="img" aria-label="Illustrative campus roads and parking lots, not a navigation map">
        <defs><pattern id="map-grid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" className="map-grid-line" fill="none" /></pattern></defs>
        <rect width="380" height="250" fill="url(#map-grid)" />
        <path d="M0 190 Q70 143 66 68T155 -20 M67 143 Q150 190 209 140T399 160 M125 255 Q132 203 213 198T345 260 M208 140L246 62L390 50" className="map-road-border" />
        <path d="M0 190 Q70 143 66 68T155 -20 M67 143 Q150 190 209 140T399 160 M125 255 Q132 203 213 198T345 260 M208 140L246 62L390 50" className="map-road" />
        <g className="map-building"><path d="M115 65h53v37h-53zM154 115h34v23h-34zM243 93h37v37h-37zM262 163h51v24h-51zM109 186h30v26h-30zM181 42h35v40h-35z" /></g>
        <g className="map-tree"><circle cx="27" cy="70" r="20"/><circle cx="42" cy="40" r="23"/><circle cx="322" cy="104" r="22"/><circle cx="340" cy="133" r="16"/><circle cx="40" cy="223" r="20"/></g>
        <circle cx="122" cy="138" r="64" className="map-radar-ring"/><circle cx="122" cy="138" r="43" className="map-radar-ring"/><circle cx="122" cy="138" r="22" className="map-radar-ring"/>
        <path d="M122 138L75 95A64 64 0 0 1 155 83Z" className="map-sweep" />
      </svg>
      <div className="map-label map-p9"><Button variant="utility" className={selected === "P9" ? "map-selected" : ""} onClick={() => onSelect("P9")}>P9 <span className="status-dot" /></Button></div>
      <div className="map-label map-p4"><Button variant="utility" className={selected === "P4" ? "map-selected" : ""} onClick={() => onSelect("P4")}>P4</Button></div>
      <div className="map-label map-p8"><Button variant="utility" className={selected === "P8" ? "map-selected" : ""} onClick={() => onSelect("P8")}>P8</Button></div>
      <div className="map-label map-inner"><Button variant="utility" className={selected === "Inner Circle" ? "map-selected" : ""} onClick={() => onSelect("Inner Circle")}>IC</Button></div>
      <div className="map-footer"><span className="status-dot" /> UTM · MISSISSAUGA <span>SCHEMATIC</span></div>
    </section>
  );
}