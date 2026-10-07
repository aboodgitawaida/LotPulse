// Single source of truth for campus lots. The map, dashboard and forecast all
// read from here. Positions and rates are real; patrol curves are simulated.

export type LotId = "P9" | "P4" | "P8" | "P11" | "CCT" | "IC";
export type Tone = "low" | "medium" | "high";

export interface Lot {
  id: LotId;
  /** Display name, e.g. "Lot P9". */
  name: string;
  /** Short label used on map pins and chips. */
  short: string;
  area: string;
  position: { lat: number; lng: number };
  /** Posted visitor rate in dollars. Real rates change, so the UI says to check signs. */
  rate: { halfHour: number; dailyMax?: number };
  /** Short practical notes: height limits, EV charging, time limits. */
  notes: readonly string[];
  /** Simulated weekday patrol probability for each hour 0–23 (0–100). */
  curve: readonly number[];
}

// Positions come from Google Maps (Plus Codes or dropped pins). Rates are the
// posted visitor rates at the time of writing.
export const LOTS: readonly Lot[] = [
  {
    id: "P9",
    name: "Lot P9",
    short: "P9",
    area: "North campus, by CCT",
    position: { lat: 43.55019, lng: -79.66119 }, // Plus Code H82Q+3G
    rate: { halfHour: 3, dailyMax: 18 },
    notes: [],
    curve: [4, 4, 4, 4, 4, 6, 12, 10, 9, 10, 14, 22, 35, 80, 88, 85, 66, 52, 38, 28, 18, 14, 12, 8],
  },
  {
    id: "P4",
    name: "Lot P4",
    short: "P4",
    area: "Parking deck, Outer Circle",
    position: { lat: 43.54706, lng: -79.65956 }, // Plus Code G8WR+R5
    rate: { halfHour: 2.75, dailyMax: 15 },
    notes: ["8'6\" clearance"],
    curve: [3, 3, 3, 3, 3, 5, 8, 7, 7, 8, 11, 17, 26, 36, 55, 62, 64, 58, 45, 33, 24, 15, 10, 6],
  },
  {
    id: "P8",
    name: "Lot P8",
    short: "P8",
    area: "Parking deck, Outer Circle",
    position: { lat: 43.54806, lng: -79.65981 }, // Plus Code G8XR+63
    rate: { halfHour: 2.75, dailyMax: 15 },
    notes: ["7' clearance", "EV charging (lower deck)"],
    curve: [2, 2, 2, 2, 2, 3, 5, 5, 4, 7, 32, 38, 33, 28, 20, 14, 10, 8, 7, 6, 5, 5, 4, 3],
  },
  {
    id: "P11",
    name: "Lot P11",
    short: "P11",
    area: "South campus, overflow",
    position: { lat: 43.54508, lng: -79.66025 }, // dropped pin
    rate: { halfHour: 2.5, dailyMax: 15 },
    notes: ["Surface lot"],
    curve: [2, 2, 2, 2, 2, 3, 6, 8, 10, 24, 46, 58, 62, 55, 44, 36, 26, 18, 12, 9, 7, 5, 4, 3],
  },
  {
    id: "CCT",
    name: "CCT Garage",
    short: "CCT",
    area: "Underground, CCT Building",
    position: { lat: 43.55056, lng: -79.66256 }, // Plus Code H82P+6X
    rate: { halfHour: 3.25, dailyMax: 20 },
    notes: ["6'4\" clearance"],
    curve: [3, 3, 3, 3, 3, 5, 9, 14, 20, 34, 52, 68, 74, 72, 65, 56, 42, 30, 20, 14, 10, 8, 6, 4],
  },
  {
    id: "IC",
    name: "Inner Circle",
    short: "IC",
    area: "Inner Circle Road",
    position: { lat: 43.5476, lng: -79.6606 }, // approximate, awaiting real location
    rate: { halfHour: 2.75 },
    notes: ["90-minute limit"],
    curve: [4, 4, 4, 4, 4, 6, 10, 9, 9, 11, 16, 25, 66, 76, 78, 70, 55, 42, 30, 21, 14, 11, 10, 7],
  },
];

export const LOT_IDS = LOTS.map((lot) => lot.id);
export const CAMPUS_CENTER = { lat: 43.548, lng: -79.661 };

export function getLot(id: LotId): Lot {
  return LOTS.find((lot) => lot.id === id) ?? LOTS[0]!;
}

export function isLotId(value: unknown): value is LotId {
  return typeof value === "string" && (LOT_IDS as string[]).includes(value);
}

// Patrols are heaviest early in the week and nearly absent on weekends.
// Indexed by Date#getDay() (0 = Sunday).
const DAY_FACTOR = [0.25, 1, 0.95, 0.95, 0.9, 0.75, 0.3] as const;

export function toneFor(threat: number): Tone {
  if (threat >= 70) return "high";
  if (threat >= 40) return "medium";
  return "low";
}

export const TONE_LABEL: Record<Tone, string> = {
  low: "Low risk",
  medium: "Moderate risk",
  high: "High risk",
};

/** Simulated hourly patrol probability (0–100) for one lot on the day of `date`. */
export function dailyForecast(lot: Lot, date: Date): number[] {
  const factor = DAY_FACTOR[date.getDay()] ?? 1;
  return lot.curve.map((value) => Math.round(value * factor));
}

/** Patrol probability right now, interpolated between hourly forecast points. */
export function threatAt(lot: Lot, date: Date): number {
  const forecast = dailyForecast(lot, date);
  const hour = date.getHours();
  const fraction = date.getMinutes() / 60;
  const current = forecast[hour] ?? 0;
  const next = forecast[(hour + 1) % 24] ?? current;
  return Math.round(current + (next - current) * fraction);
}

export interface PeakWindow {
  /** Inclusive start hour. */
  start: number;
  /** Exclusive end hour. */
  end: number;
  peak: number;
}

/** The contiguous block of hours around the daily maximum, or null on quiet days. */
export function peakWindow(forecast: readonly number[]): PeakWindow | null {
  const peak = Math.max(...forecast);
  if (peak < 40) return null;
  const peakHour = forecast.indexOf(peak);
  const threshold = peak * 0.8;
  let start = peakHour;
  let end = peakHour + 1;
  while (start > 0 && (forecast[start - 1] ?? 0) >= threshold) start--;
  while (end < forecast.length && (forecast[end] ?? 0) >= threshold) end++;
  return { start, end, peak };
}

export type Outlook =
  | { kind: "active"; window: PeakWindow; minutesLeft: number }
  | { kind: "upcoming"; window: PeakWindow; minutesUntil: number }
  | { kind: "passed"; window: PeakWindow }
  | { kind: "quiet" };

/** Where `date` sits relative to today's peak patrol window. */
export function patrolOutlook(lot: Lot, date: Date): Outlook {
  const window = peakWindow(dailyForecast(lot, date));
  if (!window) return { kind: "quiet" };
  const minutesNow = date.getHours() * 60 + date.getMinutes();
  if (minutesNow < window.start * 60) {
    return { kind: "upcoming", window, minutesUntil: window.start * 60 - minutesNow };
  }
  if (minutesNow < window.end * 60) {
    return { kind: "active", window, minutesLeft: window.end * 60 - minutesNow };
  }
  return { kind: "passed", window };
}
