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
}

export function FocusLot({ lot, status, now, live = false }: FocusLotProps) {
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
          <p className="live-status" data-spotted={status.spotted} aria-live="polite">
            <span className="status-dot" aria-hidden />
            {status.spotted ? "Spotted" : "Clear"}
          </p>
          <p className="metric-detail">
            {lastSighting ? (
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
            <ThreatGauge count={status.recentReports} tone={status.tone} />
            <div className="threat-copy">
              <span className="tone-pill" data-tone={status.tone}>
                {TONE_LABEL[status.tone]}
              </span>
              <p className="outlook">
                <strong>
                  {status.recentReports === 0
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
