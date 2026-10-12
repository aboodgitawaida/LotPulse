// Single source of truth for campus lots. The map and dashboard read from here,
// along with the rule that turns recent reports into a risk level.

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
  },
  {
    id: "P4",
    name: "Lot P4",
    short: "P4",
    area: "Parking deck, Outer Circle",
    position: { lat: 43.54706, lng: -79.65956 }, // Plus Code G8WR+R5
    rate: { halfHour: 2.75, dailyMax: 15 },
    notes: ["8'6\" clearance"],
  },
  {
    id: "P8",
    name: "Lot P8",
    short: "P8",
    area: "Parking deck, Outer Circle",
    position: { lat: 43.54806, lng: -79.65981 }, // Plus Code G8XR+63
    rate: { halfHour: 2.75, dailyMax: 15 },
    notes: ["7' clearance", "EV charging (lower deck)"],
  },
  {
    id: "P11",
    name: "Lot P11",
    short: "P11",
    area: "South campus, overflow",
    position: { lat: 43.54508, lng: -79.66025 }, // dropped pin
    rate: { halfHour: 2.5, dailyMax: 15 },
    notes: ["Surface lot"],
  },
  {
    id: "CCT",
    name: "CCT Garage",
    short: "CCT",
    area: "Underground, CCT Building",
    position: { lat: 43.55056, lng: -79.66256 }, // Plus Code H82P+6X
    rate: { halfHour: 3.25, dailyMax: 20 },
    notes: ["6'4\" clearance"],
  },
  {
    id: "IC",
    name: "Inner Circle",
    short: "IC",
    area: "Inner Circle Road",
    position: { lat: 43.54719, lng: -79.66226 }, // dropped pin
    rate: { halfHour: 2.75 },
    notes: ["90-minute limit"],
  },
];

export const LOT_IDS = LOTS.map((lot) => lot.id);
export const CAMPUS_CENTER = { lat: 43.548, lng: -79.661 };
/** The map can't be panned outside this box: the UTM campus with a little margin. */
export const CAMPUS_BOUNDS = {
  south: 43.5395,
  west: -79.672,
  north: 43.5565,
  east: -79.6525,
} as const;
/** The furthest the map can zoom out, so it stays on campus. */
export const CAMPUS_MIN_ZOOM = 15;

export function getLot(id: LotId): Lot {
  return LOTS.find((lot) => lot.id === id) ?? LOTS[0]!;
}

export function isLotId(value: unknown): value is LotId {
  return typeof value === "string" && (LOT_IDS as string[]).includes(value);
}

/** Risk counts the reports for a lot in this many minutes. */
export const RISK_WINDOW_MINUTES = 120;

/**
 * The whole risk rule: reports for a lot in the last 2 hours.
 * 0 = clear, 1 = caution, 2 or more = high.
 */
export function riskFor(recentReports: number): Tone {
  if (recentReports >= 2) return "high";
  if (recentReports === 1) return "medium";
  return "low";
}

export const TONE_LABEL: Record<Tone, string> = {
  low: "Clear",
  medium: "Caution",
  high: "High risk",
};
