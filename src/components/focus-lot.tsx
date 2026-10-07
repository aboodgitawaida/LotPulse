import { CircleParking, Clock3, CreditCard, Radio, Sparkles, TimerReset } from "lucide-react";

import { ThreatGauge } from "@/components/threat-gauge";
import { formatDuration, formatRate, formatWindow, timeAgo } from "@/lib/format";
import { TONE_LABEL, patrolOutlook, type Lot } from "@/lib/lots";
import type { LotStatus } from "@/lib/store";

interface FocusLotProps {
  lot: Lot;
  status: LotStatus;
  now: Date;
  onPay: () => void;
}

function OutlookText({ lot, now }: { lot: Lot; now: Date }) {
  const outlook = patrolOutlook(lot, now);
  switch (outlook.kind) {
    case "active":
      return (
        <>
          <strong>Peak patrol window now</strong>
          <span>
            {formatWindow(outlook.window)} · ends in {formatDuration(outlook.minutesLeft)}
          </span>
        </>
      );
    case "upcoming":
      return (
        <>
          <strong>Next peak in {formatDuration(outlook.minutesUntil)}</strong>
          <span>Expected {formatWindow(outlook.window)}</span>
        </>
      );
    case "passed":
      return (
        <>
          <strong>Today's peak has passed</strong>
          <span>It was {formatWindow(outlook.window)}</span>
        </>
      );
    case "quiet":
      return (
        <>
          <strong>Quiet day</strong>
          <span>No patrol peak expected</span>
        </>
      );
  }
}

export function FocusLot({ lot, status, now, onPay }: FocusLotProps) {
  const { lastSighting, session } = status;
  const sessionMinutes = session ? Math.ceil((session.until - now.getTime()) / 60_000) : 0;

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
                Last sighting <strong>{timeAgo(lastSighting.at, now.getTime())}</strong>
                <span className="metric-sub">
                  by {lastSighting.mine ? "you" : lastSighting.scout}
                </span>
              </>
            ) : (
              "No sightings yet today"
            )}
          </p>
        </div>

        <div className="metric metric-threat">
          <span className="eyebrow">
            <Sparkles aria-hidden /> Patrol probability
          </span>
          <div className="threat-readout">
            <ThreatGauge value={status.threat} tone={status.tone} />
            <div className="threat-copy">
              <span className="tone-pill" data-tone={status.tone}>
                {TONE_LABEL[status.tone]}
              </span>
              <p className="outlook">
                <OutlookText lot={lot} now={now} />
              </p>
            </div>
          </div>
        </div>
      </div>

      <footer className="focus-lot-footer">
        <button type="button" className="jit-button" onClick={onPay} data-active={session !== null}>
          {session ? <TimerReset aria-hidden /> : <CreditCard aria-hidden />}
          {session ? (
            <span>
              Session · <strong>{formatDuration(sessionMinutes)} left</strong>
            </span>
          ) : (
            <span>
              Pay 30 min <span className="jit-tag">JIT</span>
            </span>
          )}
        </button>
        <span className="focus-lot-updated">
          <Clock3 aria-hidden /> Simulated · student signals + forecast
        </span>
      </footer>
    </section>
  );
}
