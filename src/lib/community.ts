// Clout rules, tiers and badges. Points themselves are counted by the database
// (weekly_leaderboard in supabase/migrations): 25 per report since Monday.

export const POINTS_PER_REPORT = 25;
/** A scout can report the same lot at most once per cooldown window (the database enforces it). */
export const REPORT_COOLDOWN_MINUTES = 5;

export interface LeaderboardRow {
  name: string;
  points: number;
  you: boolean;
  rank: number;
}

/** Sort by points (you first on ties) and number the ranks. */
export function rankLeaderboard(
  rows: readonly Omit<LeaderboardRow, "rank">[],
  extraYou: { name: string; points: number } | null = null,
): LeaderboardRow[] {
  const all = extraYou ? [...rows, { ...extraYou, you: true }] : [...rows];
  return all
    .sort((a, b) => b.points - a.points || Number(b.you) - Number(a.you))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export interface Tier {
  name: string;
  min: number;
}

export const TIERS: readonly Tier[] = [
  { name: "Rookie scout", min: 0 },
  { name: "Scout", min: 150 },
  { name: "Ranger", min: 250 },
  { name: "Campus legend", min: 400 },
];

export function tierFor(points: number): { current: Tier; next: Tier | null } {
  let index = 0;
  TIERS.forEach((tier, i) => {
    if (points >= tier.min) index = i;
  });
  return { current: TIERS[index]!, next: TIERS[index + 1] ?? null };
}

export type BadgeId = "first-signal" | "hat-trick" | "campus-wide";

export interface Badge {
  id: BadgeId;
  name: string;
  description: string;
}

export const BADGES: readonly Badge[] = [
  { id: "first-signal", name: "First signal", description: "Send your first report" },
  { id: "hat-trick", name: "Hat trick", description: "Send 3 reports" },
  { id: "campus-wide", name: "Campus-wide", description: "Report in every lot" },
];
