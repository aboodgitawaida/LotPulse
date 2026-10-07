import { ArrowRight, BellRing, Crosshair } from "lucide-react";

import { POINTS_PER_REPORT } from "@/lib/community";
import type { Lot } from "@/lib/lots";

interface ReportButtonProps {
  lot: Lot;
  cooldownMinutes: number;
  onReport: () => void;
}

export function ReportButton({ lot, cooldownMinutes, onReport }: ReportButtonProps) {
  const coolingDown = cooldownMinutes > 0;
  return (
    <div className="report">
      <button type="button" className="report-button" onClick={onReport} disabled={coolingDown}>
        <span className="report-button-icon" aria-hidden>
          {coolingDown ? <BellRing /> : <Crosshair />}
        </span>
        <span className="report-button-text">
          <strong>{coolingDown ? "Campus alerted" : `Spotted enforcement at ${lot.short}`}</strong>
          <small>
            {coolingDown
              ? `Thanks, scout. You can report ${lot.short} again in ${cooldownMinutes} min.`
              : `Warn everyone parked here · +${POINTS_PER_REPORT} clout`}
          </small>
        </span>
        {!coolingDown && <ArrowRight className="report-button-arrow" aria-hidden />}
      </button>
    </div>
  );
}
