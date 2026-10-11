import { LOTS, TONE_LABEL, type LotId } from "@/lib/lots";
import type { LotStatus } from "@/lib/store";

interface LotSwitcherProps {
  selected: LotId;
  statusFor: (lot: LotId) => LotStatus;
  onSelect: (lot: LotId) => void;
}

export function LotSwitcher({ selected, statusFor, onSelect }: LotSwitcherProps) {
  return (
    <nav className="lot-switcher" aria-label="Choose a lot">
      {LOTS.map((lot, index) => {
        const status = statusFor(lot.id);
        return (
          <button
            key={lot.id}
            type="button"
            className="lot-chip"
            data-tone={status.tone}
            aria-pressed={lot.id === selected}
            aria-label={`${lot.name}, ${TONE_LABEL[status.tone]}, ${status.recentReports} ${status.recentReports === 1 ? "report" : "reports"} in the last 2 hours`}
            onClick={() => onSelect(lot.id)}
          >
            <span className="lot-chip-top">
              <span className="lot-chip-name">
                <span className="lot-chip-index" aria-hidden>
                  {String(index + 1).padStart(2, "0")}
                </span>
                {lot.short}
              </span>
              {status.spotted && <span className="spotted-dot" aria-hidden />}
            </span>
            <span className="lot-chip-threat">
              {status.recentReports}
              <small>/2h</small>
            </span>
            <span className="lot-chip-bar" aria-hidden>
              <span style={{ width: `${(Math.min(status.recentReports, 2) / 2) * 100}%` }} />
            </span>
          </button>
        );
      })}
    </nav>
  );
}
