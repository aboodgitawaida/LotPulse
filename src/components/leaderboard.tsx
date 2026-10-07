import { Trophy } from "lucide-react";

import { OTHER_SCOUTS } from "@/lib/community";

interface LeaderboardProps {
  points: number;
  /** How many rows to show above "You" (you are always shown). */
  limit?: number;
}

function initials(name: string) {
  const parts = name.split(/[_\s]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase();
}

export function Leaderboard({ points, limit = 3 }: LeaderboardProps) {
  const rows = [
    ...OTHER_SCOUTS.map((scout) => ({ ...scout, you: false })),
    { name: "You", points, you: true },
  ]
    .sort((a, b) => b.points - a.points || Number(b.you) - Number(a.you))
    .map((row, index) => ({ ...row, rank: index + 1 }));
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
      <ol className="leaderboard-list">
        {visible.map((row, index) => (
          <li
            key={row.name}
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
            <span className="leaderboard-name">{row.name}</span>
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
