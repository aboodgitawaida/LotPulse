import { Activity, CircleParking, Clock3, Radio } from "lucide-react";

import { ThreatGauge } from "@/components/threat-gauge";
import { formatRate, timeAgo } from "@/lib/format";
import { TONE_LABEL, type Lot } from "@/lib/lots";
import type { LotStatus } from "@/lib/store";

interface FocusLotProps {
  lot: Lot;
  status: LotStatus;
  now: Date;
  live?: boolean;
  /** False while reports are loading or unreachable: don't claim the lot is clear. */
  known?: boolean;
  /** Shown instead of the status while it isn't known. */
  unknownReason?: string;
}

export function FocusLot({
  lot,
  status,
  now,
  live = false,
  known = true,
  unknownReason = "Checking for reports…",
}: FocusLotProps) {
  const { lastSighting } = status;

  return (
    <section className="card focus-lot" aria-labelledby="focus-lot-title" data-tone={status.tone}>
      <header className="focus-lot-header">
        <span className="focus-lot-icon" aria-hidden>
          <CircleParking />
        </span>
        <div>
          <h2 id="focus-lot-title">{lot.name}</h2>
          <p>{lot.area}</p>
        </div>
        <ul className="lot-facts" aria-label={`${lot.name} details`}>
          <li>{formatRate(lot.rate)}</li>
          {lot.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </header>

      <div className="focus-lot-metrics">
        <div className="metric">
          <span className="eyebrow">
            <Radio aria-hidden /> Live status
          </span>
          <p
            className="live-status"
            data-spotted={known && status.spotted}
            data-unknown={!known}
            aria-live="polite"
          >
            <span className="status-dot" aria-hidden />
            {!known ? "Unknown" : status.spotted ? "Spotted" : "Clear"}
          </p>
          <p className="metric-detail">
            {!known ? (
              unknownReason
            ) : lastSighting ? (
              <>
                Last report <strong>{timeAgo(lastSighting.at, now.getTime())}</strong>
                <span className="metric-sub">
                  by {lastSighting.mine ? "you" : lastSighting.scout}
                </span>
              </>
            ) : (
              "No recent reports"
            )}
          </p>
        </div>

        <div className="metric metric-threat">
          <span className="eyebrow">
            <Activity aria-hidden /> Reports · last 2h
          </span>
          <div className="threat-readout">
            <ThreatGauge
              count={known ? status.recentReports : null}
              tone={known ? status.tone : "unknown"}
            />
            <div className="threat-copy">
              <span className="tone-pill" data-tone={known ? status.tone : "unknown"}>
                {known ? TONE_LABEL[status.tone] : "Unknown"}
              </span>
              <p className="outlook">
                <strong>
                  {!known
                    ? unknownReason
                    : status.recentReports === 0
                      ? "No recent reports"
                      : `${status.recentReports} ${status.recentReports === 1 ? "report" : "reports"} in the last 2 hours`}
                </strong>
                <span>0 clear · 1 caution · 2+ high risk</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <footer className="focus-lot-footer">
        <span className="focus-lot-updated">
          <Clock3 aria-hidden />{" "}
          {live ? "Live scout reports" : "Not connected · no reports to show"}
        </span>
      </footer>
    </section>
  );
}
