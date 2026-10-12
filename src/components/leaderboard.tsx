import { Trophy } from "lucide-react";

import type { LeaderboardRow } from "@/lib/community";

interface LeaderboardProps {
  /** Ranked rows, best first. */
  rows: LeaderboardRow[];
  /** How many rows to show above "You" (you are always shown). */
  limit?: number;
}

function initials(name: string) {
  const parts = name.split(/[_\s]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase();
}

export function Leaderboard({ rows, limit = 3 }: LeaderboardProps) {
  const top = rows.slice(0, limit);
  const you = rows.find((row) => row.you);
  const visible = you && !top.includes(you) ? [...top, you] : top;

  return (
    <section className="card leaderboard" aria-labelledby="leaderboard-title">
      <header className="card-header">
        <h2 id="leaderboard-title" className="eyebrow">
          <Trophy aria-hidden /> Weekly top scouts
        </h2>
      </header>
      {visible.length === 0 && (
        <p className="card-empty">No reports this week yet. Be the first scout on the board.</p>
      )}
      <ol className="leaderboard-list">
        {visible.map((row, index) => (
          <li
            key={`${row.rank}-${row.name}`}
            className="leaderboard-row"
            data-you={row.you}
            data-gap={index > 0 && row.rank - (visible[index - 1]?.rank ?? 0) > 1}
            aria-current={row.you ? "true" : undefined}
          >
            <span className="leaderboard-rank" data-podium={row.rank <= 3}>
              {row.rank}
            </span>
            <span className="leaderboard-avatar" aria-hidden>
              {row.you ? "YOU" : initials(row.name)}
            </span>
            <span className="leaderboard-name">
              {row.name}
              {row.you && row.name !== "You" && <small> (you)</small>}
            </span>
            <span className="leaderboard-points">
              {row.points}
              <small> pts</small>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
