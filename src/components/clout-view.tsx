import { Award, Lock, ShieldCheck, Trash2, Zap } from "lucide-react";

import { Leaderboard } from "@/components/leaderboard";
import {
  BADGES,
  POINTS_PER_REPORT,
  REPORT_COOLDOWN_MINUTES,
  tierFor,
  type BadgeId,
  type LeaderboardRow,
} from "@/lib/community";
import { LOTS } from "@/lib/lots";
import type { Report } from "@/lib/store";

interface CloutViewProps {
  points: number;
  /** Null until you're on this week's board. */
  rank: number | null;
  reports: Report[];
  badges: Set<BadgeId>;
  leaderboard: LeaderboardRow[];
  /** Reports couldn't be loaded right now. */
  unavailable?: boolean;
  /** Set once you have a scout name, so there's data to delete. */
  onDeleteData?: (() => void) | undefined;
}

export function CloutView({
  points,
  rank,
  reports,
  badges,
  leaderboard,
  unavailable = false,
  onDeleteData,
}: CloutViewProps) {
  const scouts = leaderboard.length;
  const { current, next } = tierFor(points);
  const progress = next ? ((points - current.min) / (next.min - current.min)) * 100 : 100;
  const lotsCovered = new Set(reports.map((r) => r.lot)).size;

  return (
    <div className="clout">
      <section className="card clout-hero" aria-labelledby="clout-score">
        <div>
          <span className="eyebrow">
            <Zap aria-hidden /> Your weekly clout
          </span>
          <p id="clout-score" className="clout-points">
            {points}
            <small> pts</small>
          </p>
          <p className="clout-tier">
            {current.name} ·{" "}
            {rank === null ? (
              "not on the board yet. Send a report to join."
            ) : (
              <>
                <strong>#{rank}</strong> of {scouts} {scouts === 1 ? "scout" : "scouts"}
              </>
            )}
          </p>
        </div>
        <div className="tier-progress">
          <div className="tier-progress-labels">
            <span>{current.name}</span>
            <span>{next ? `${next.min - points} pts to ${next.name}` : "Top tier reached"}</span>
          </div>
          <div
            className="tier-progress-bar"
            role="progressbar"
            aria-label={next ? `Progress to ${next.name}` : "Top tier reached"}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
        <dl className="clout-stats">
          <div>
            <dt>Reports</dt>
            <dd>{reports.length}</dd>
          </div>
          <div>
            <dt>Lots covered</dt>
            <dd>
              {lotsCovered}/{LOTS.length}
            </dd>
          </div>
        </dl>
      </section>

      <section className="card" aria-labelledby="badges-title">
        <header className="card-header">
          <h2 id="badges-title" className="eyebrow">
            <Award aria-hidden /> Badges
          </h2>
          <span className="card-meta">
            {BADGES.filter((badge) => badges.has(badge.id)).length}/{BADGES.length} earned
          </span>
        </header>
        <ul className="badge-grid">
          {BADGES.map((badge) => {
            const earned = badges.has(badge.id);
            return (
              <li key={badge.id} className="badge" data-earned={earned}>
                <span className="badge-icon" aria-hidden>
                  {earned ? <Award /> : <Lock />}
                </span>
                <strong>{badge.name}</strong>
                <span>{badge.description}</span>
                <span className="sr-only">{earned ? "Earned" : "Locked"}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <Leaderboard rows={leaderboard} limit={50} unavailable={unavailable} />

      <section className="card how-it-works" aria-labelledby="how-title">
        <h2 id="how-title" className="eyebrow">
          <ShieldCheck aria-hidden /> How clout works
        </h2>
        <ul>
          <li>Every report earns +{POINTS_PER_REPORT} clout, counted by the database.</li>
          <li>You can report each lot once every {REPORT_COOLDOWN_MINUTES} minutes, so no spam.</li>
          <li>The leaderboard resets every Monday. Climb the tiers to earn your badges.</li>
        </ul>
        {onDeleteData && (
          <button type="button" className="text-button text-button-danger" onClick={onDeleteData}>
            <Trash2 aria-hidden /> Delete my data
          </button>
        )}
      </section>
    </div>
  );
}
