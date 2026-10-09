import { Award, Lock, RotateCcw, ShieldCheck, Zap } from "lucide-react";

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
import type { Payment, Report } from "@/lib/store";

interface CloutViewProps {
  points: number;
  rank: number;
  reports: Report[];
  payments: Payment[];
  badges: Set<BadgeId>;
  leaderboard: LeaderboardRow[];
  /** Demo mode only: wipe simulated progress. */
  onReset?: () => void;
  /** Demo mode only: show the simulated JIT payment stat and badge. */
  showJit?: boolean;
}

export function CloutView({
  points,
  rank,
  reports,
  payments,
  badges,
  leaderboard,
  onReset,
  showJit = true,
}: CloutViewProps) {
  const badgeList = showJit ? BADGES : BADGES.filter((badge) => badge.id !== "just-in-time");
  const scouts = Math.max(leaderboard.length, rank);
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
            {current.name} · <strong>#{rank}</strong> of {scouts}{" "}
            {scouts === 1 ? "scout" : "scouts"}
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
            <dt>Sightings</dt>
            <dd>{reports.length}</dd>
          </div>
          <div>
            <dt>Lots covered</dt>
            <dd>
              {lotsCovered}/{LOTS.length}
            </dd>
          </div>
          {showJit && (
            <div>
              <dt>JIT sessions</dt>
              <dd>{payments.length}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="card" aria-labelledby="badges-title">
        <header className="card-header">
          <h2 id="badges-title" className="eyebrow">
            <Award aria-hidden /> Badges
          </h2>
          <span className="card-meta">
            {badgeList.filter((badge) => badges.has(badge.id)).length}/{badgeList.length} earned
          </span>
        </header>
        <ul className="badge-grid">
          {badgeList.map((badge) => {
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

      <Leaderboard rows={leaderboard} limit={50} />

      <section className="card how-it-works" aria-labelledby="how-title">
        <h2 id="how-title" className="eyebrow">
          <ShieldCheck aria-hidden /> How clout works
        </h2>
        <ul>
          <li>Every sighting you report earns +{POINTS_PER_REPORT} clout.</li>
          <li>You can report each lot once every {REPORT_COOLDOWN_MINUTES} minutes, so no spam.</li>
          <li>The leaderboard resets every Monday. Climb the tiers to earn your badges.</li>
        </ul>
        {onReset && (
          <button type="button" className="text-button" onClick={onReset}>
            <RotateCcw aria-hidden /> Reset demo progress
          </button>
        )}
      </section>
    </div>
  );
}
