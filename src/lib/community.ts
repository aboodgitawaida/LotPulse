// Simulated community data for the demo: other scouts, recent sightings,
// clout tiers and badges.
import type { LotId } from "./lots";

export const BASE_POINTS = 120;
export const POINTS_PER_REPORT = 25;
/** A scout can report the same lot at most once per cooldown window. */
export const REPORT_COOLDOWN_MINUTES = 15;
/** A lot shows as "spotted" for this long after the latest sighting. */
export const SPOTTED_WINDOW_MINUTES = 30;
export const SESSION_MINUTES = 30;

export interface Scout {
  name: string;
  points: number;
}

export const OTHER_SCOUTS: readonly Scout[] = [
  { name: "UofT_Driver", points: 450 },
  { name: "parking_ninja", points: 380 },
  { name: "UTM_scout", points: 325 },
  { name: "maple_parker", points: 290 },
  { name: "north_lot_nate", points: 240 },
  { name: "deerfield_dash", points: 205 },
  { name: "kaneff_kid", points: 160 },
  { name: "ccit_crawler", points: 135 },
];

export interface SeedSighting {
  lot: LotId;
  scout: string;
  minutesAgo: number;
}

/** Sightings placed relative to when the page was opened. */
export const SEED_SIGHTINGS: readonly SeedSighting[] = [
  { lot: "IC", scout: "parking_ninja", minutesAgo: 18 },
  { lot: "P4", scout: "UTM_scout", minutesAgo: 72 },
  { lot: "P9", scout: "UofT_Driver", minutesAgo: 180 },
  { lot: "P4", scout: "north_lot_nate", minutesAgo: 300 },
  { lot: "P8", scout: "maple_parker", minutesAgo: 420 },
];

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

export type BadgeId = "first-signal" | "hat-trick" | "campus-wide" | "just-in-time";

export interface Badge {
  id: BadgeId;
  name: string;
  description: string;
}

export const BADGES: readonly Badge[] = [
  { id: "first-signal", name: "First signal", description: "Send your first sighting" },
  { id: "hat-trick", name: "Hat trick", description: "Send 3 sightings" },
  { id: "campus-wide", name: "Campus-wide", description: "Report in every lot" },
  { id: "just-in-time", name: "Just in time", description: "Start a JIT parking session" },
];
