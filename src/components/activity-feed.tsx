import { Activity, Crosshair } from "lucide-react";

import { timeAgo } from "@/lib/format";
import { getLot, type LotId } from "@/lib/lots";
import type { Sighting } from "@/lib/store";

interface ActivityFeedProps {
  sightings: Sighting[];
  now: Date;
  onSelect: (lot: LotId) => void;
  limit?: number;
  live?: boolean;
  loading?: boolean;
}

export function ActivityFeed({
  sightings,
  now,
  onSelect,
  limit = 5,
  live = false,
  loading = false,
}: ActivityFeedProps) {
  return (
    <section className="card feed" aria-labelledby="feed-title">
      <header className="card-header">
        <h2 id="feed-title" className="eyebrow">
          <Activity aria-hidden /> Recent reports
        </h2>
        <span className="live-chip" data-live={live}>
          <span className="status-dot" aria-hidden /> {live ? "Live" : "Not connected"}
        </span>
      </header>
      {sightings.length === 0 && (
        <p className="card-empty">
          {loading ? "Loading reports…" : "No reports in the last 24 hours. Quiet day so far."}
        </p>
      )}
      <ol className="feed-list">
        {sightings.slice(0, limit).map((sighting) => (
          <li key={sighting.id}>
            <button
              type="button"
              className="feed-item"
              data-mine={sighting.mine}
              onClick={() => onSelect(sighting.lot)}
            >
              <span className="feed-icon" aria-hidden>
                <Crosshair />
              </span>
              <span className="feed-text">
                <strong>Enforcement at {getLot(sighting.lot).name}</strong>
                <span>
                  {sighting.mine ? "You" : sighting.scout} · {timeAgo(sighting.at, now.getTime())}
                </span>
              </span>
              <span className="feed-lot">{getLot(sighting.lot).short}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
