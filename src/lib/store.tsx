// Client-side app state. Everything here is simulated and only lives in this
// browser (persisted to localStorage so a refresh doesn't wipe your clout).
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";

import {
  BASE_POINTS,
  OTHER_SCOUTS,
  POINTS_PER_REPORT,
  REPORT_COOLDOWN_MINUTES,
  SEED_SIGHTINGS,
  SESSION_MINUTES,
  SPOTTED_WINDOW_MINUTES,
  type BadgeId,
} from "./community";
import { LOT_IDS, getLot, isLotId, threatAt, toneFor, type LotId, type Tone } from "./lots";

const STORAGE_KEY = "lotpulse:v1";
const MINUTE = 60_000;

export interface Report {
  id: string;
  lot: LotId;
  at: number;
}

export interface Payment {
  lot: LotId;
  at: number;
  until: number;
}

interface PersistedState {
  selected: LotId;
  reports: Report[];
  payments: Payment[];
}

type Action =
  | { type: "select"; lot: LotId }
  | { type: "report"; report: Report }
  | { type: "undo-report"; id: string }
  | { type: "pay"; lot: LotId; at: number }
  | { type: "reset" };

const INITIAL_STATE: PersistedState = { selected: "P9", reports: [], payments: [] };

function reducer(state: PersistedState, action: Action): PersistedState {
  switch (action.type) {
    case "select":
      return { ...state, selected: action.lot };
    case "report":
      return { ...state, reports: [...state.reports, action.report] };
    case "undo-report":
      return { ...state, reports: state.reports.filter((report) => report.id !== action.id) };
    case "pay": {
      // Paying again while a session is running extends it instead of stacking.
      const active = state.payments.find((p) => p.lot === action.lot && p.until > action.at);
      const extension = SESSION_MINUTES * MINUTE;
      if (active) {
        return {
          ...state,
          payments: state.payments.map((p) =>
            p === active ? { ...p, until: p.until + extension } : p,
          ),
        };
      }
      return {
        ...state,
        payments: [
          ...state.payments,
          { lot: action.lot, at: action.at, until: action.at + extension },
        ],
      };
    }
    case "reset":
      return { ...INITIAL_STATE, selected: state.selected };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function loadState(): PersistedState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_STATE;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return INITIAL_STATE;
    const reports = Array.isArray(parsed["reports"])
      ? parsed["reports"].filter(
          (r): r is Report =>
            isRecord(r) &&
            typeof r["id"] === "string" &&
            isLotId(r["lot"]) &&
            typeof r["at"] === "number",
        )
      : [];
    const payments = Array.isArray(parsed["payments"])
      ? parsed["payments"].filter(
          (p): p is Payment =>
            isRecord(p) &&
            isLotId(p["lot"]) &&
            typeof p["at"] === "number" &&
            typeof p["until"] === "number",
        )
      : [];
    return {
      selected: isLotId(parsed["selected"]) ? parsed["selected"] : INITIAL_STATE.selected,
      reports,
      payments,
    };
  } catch {
    return INITIAL_STATE;
  }
}

function saveState(state: PersistedState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode or storage disabled: state just won't survive a refresh.
  }
}

export interface Sighting {
  id: string;
  lot: LotId;
  scout: string;
  at: number;
  mine: boolean;
}

export interface LotStatus {
  threat: number;
  tone: Tone;
  lastSighting: Sighting | null;
  spotted: boolean;
  /** Minutes until this scout may report the lot again (0 = can report). */
  cooldownMinutes: number;
  /** Active simulated parking session, if any. */
  session: Payment | null;
}

interface StoreValue {
  now: Date;
  selected: LotId;
  reports: Report[];
  payments: Payment[];
  sightings: Sighting[];
  points: number;
  badges: Set<BadgeId>;
  rank: number;
  statusFor: (lot: LotId) => LotStatus;
  select: (lot: LotId) => void;
  report: (lot: LotId) => Report;
  undoReport: (id: string) => void;
  pay: (lot: LotId) => void;
  reset: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

/** Re-render on a fixed tick so countdowns and threat levels stay current. */
function useNow(intervalMs = 20_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  const refresh = useCallback(() => setNow(new Date()), []);
  return [now, refresh] as const;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE, loadState);
  const [openedAt] = useState(() => Date.now());
  // Actions refresh the clock so derived values (cooldowns, sessions) are exact.
  const [now, refreshNow] = useNow();

  useEffect(() => saveState(state), [state]);

  const sightings = useMemo<Sighting[]>(() => {
    const seeded = SEED_SIGHTINGS.map((seed, index) => ({
      id: `seed-${index}`,
      lot: seed.lot,
      scout: seed.scout,
      at: openedAt - seed.minutesAgo * MINUTE,
      mine: false,
    }));
    const mine = state.reports.map((report) => ({
      id: report.id,
      lot: report.lot,
      scout: "You",
      at: report.at,
      mine: true,
    }));
    return [...seeded, ...mine].sort((a, b) => b.at - a.at);
  }, [openedAt, state.reports]);

  const points = BASE_POINTS + state.reports.length * POINTS_PER_REPORT;
  const rank = OTHER_SCOUTS.filter((scout) => scout.points > points).length + 1;

  const badges = useMemo(() => {
    const earned = new Set<BadgeId>();
    const reportedLots = new Set(state.reports.map((r) => r.lot));
    if (state.reports.length >= 1) earned.add("first-signal");
    if (state.reports.length >= 3) earned.add("hat-trick");
    if (LOT_IDS.every((id) => reportedLots.has(id))) earned.add("campus-wide");
    if (state.payments.length > 0) earned.add("just-in-time");
    return earned;
  }, [state.reports, state.payments]);

  const statusFor = useCallback(
    (lotId: LotId): LotStatus => {
      const nowMs = now.getTime();
      const lastSighting = sightings.find((s) => s.lot === lotId) ?? null;
      const spotted =
        lastSighting !== null && nowMs - lastSighting.at < SPOTTED_WINDOW_MINUTES * MINUTE;
      const lastMine = state.reports.filter((r) => r.lot === lotId).at(-1);
      const cooldownMs = lastMine ? lastMine.at + REPORT_COOLDOWN_MINUTES * MINUTE - nowMs : 0;
      // A fresh sighting means enforcement is on site: lift the prediction.
      const predicted = threatAt(getLot(lotId), now);
      const threat = spotted ? Math.max(predicted, 90) : predicted;
      return {
        threat,
        tone: toneFor(threat),
        lastSighting,
        spotted,
        cooldownMinutes: cooldownMs > 0 ? Math.ceil(cooldownMs / MINUTE) : 0,
        session: state.payments.find((p) => p.lot === lotId && p.until > nowMs) ?? null,
      };
    },
    [now, sightings, state.reports, state.payments],
  );

  const value = useMemo<StoreValue>(
    () => ({
      now,
      selected: state.selected,
      reports: state.reports,
      payments: state.payments,
      sightings,
      points,
      badges,
      rank,
      statusFor,
      select: (lot) => dispatch({ type: "select", lot }),
      report: (lot) => {
        const report = { id: `r-${Date.now().toString(36)}`, lot, at: Date.now() };
        dispatch({ type: "report", report });
        refreshNow();
        return report;
      },
      undoReport: (id) => dispatch({ type: "undo-report", id }),
      pay: (lot) => {
        dispatch({ type: "pay", lot, at: Date.now() });
        refreshNow();
      },
      reset: () => dispatch({ type: "reset" }),
    }),
    [now, refreshNow, state, sightings, points, badges, rank, statusFor],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside <StoreProvider>");
  return store;
}
