import { Activity, Crosshair } from "lucide-react";

import { timeAgo } from "@/lib/format";
import { getLot, type LotId } from "@/lib/lots";
import type { FeedReport } from "@/lib/store";

interface ActivityFeedProps {
  feed: FeedReport[];
  now: Date;
  onSelect: (lot: LotId) => void;
  limit?: number;
  live?: boolean;
  loading?: boolean;
  /** Reports couldn't be loaded; retrying. */
  unreachable?: boolean;
}

export function ActivityFeed({
  feed,
  now,
  onSelect,
  limit = 5,
  live = false,
  loading = false,
  unreachable = false,
}: ActivityFeedProps) {
  return (
    <section className="card feed" aria-labelledby="feed-title">
      <header className="card-header">
        <h2 id="feed-title" className="eyebrow">
          <Activity aria-hidden /> Recent reports
        </h2>
        <span className="live-chip" data-live={live && !unreachable}>
          <span className="status-dot" aria-hidden />{" "}
          {!live ? "Not connected" : unreachable ? "Reconnecting" : "Live"}
        </span>
      </header>
      {feed.length === 0 && (
        <p className="card-empty">
          {unreachable
            ? "Can't reach live reports right now. Retrying…"
            : loading
              ? "Loading reports…"
              : "No reports in the last 24 hours. Quiet day so far."}
        </p>
      )}
      <ol className="feed-list">
        {feed.slice(0, limit).map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              className="feed-item"
              data-mine={entry.mine}
              onClick={() => onSelect(entry.lot)}
            >
              <span className="feed-icon" aria-hidden>
                <Crosshair />
              </span>
              <span className="feed-text">
                <strong>Enforcement at {getLot(entry.lot).name}</strong>
                <span>
                  {entry.mine ? "You" : entry.scout} · {timeAgo(entry.at, now.getTime())}
                </span>
              </span>
              <span className="feed-lot">{getLot(entry.lot).short}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
