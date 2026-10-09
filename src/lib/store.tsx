// App state. Sightings, clout and the leaderboard come from Supabase when it's
// configured ("live" mode) and are simulated in this browser otherwise ("demo"
// mode). Lot selection and JIT parking sessions are always local.
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
  rankLeaderboard,
  type BadgeId,
  type LeaderboardRow,
} from "./community";
import { useLiveCommunity } from "./live";
import { LOT_IDS, getLot, isLotId, threatAt, toneFor, type LotId, type Tone } from "./lots";
import { supabase } from "./supabase";

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
  mode: "demo" | "live";
  /** Live mode only: true until the first sightings load. */
  loading: boolean;
  now: Date;
  selected: LotId;
  /** Your sightings (this week in live mode). */
  reports: Report[];
  payments: Payment[];
  sightings: Sighting[];
  leaderboard: LeaderboardRow[];
  points: number;
  badges: Set<BadgeId>;
  rank: number;
  /** Live mode: you still need to pick a public scout name before reporting. */
  needsName: boolean;
  statusFor: (lot: LotId) => LotStatus;
  select: (lot: LotId) => void;
  /** Rejects with a user-facing message (cooldown, rate limit, taken name…). */
  report: (lot: LotId, scoutName?: string) => Promise<Report>;
  undoReport: (id: string) => Promise<void>;
  pay: (lot: LotId) => void;
  /** Demo mode only. */
  reset: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

/** Re-render on a fixed tick so countdowns and threat levels stay current. */
function useNow(intervalMs = 20_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    // Background tabs throttle timers; catch up as soon as the page is back.
    const onVisible = () => {
      if (document.visibilityState === "visible") setNow(new Date());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
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

  const live = useLiveCommunity(supabase);

  const sightings = useMemo<Sighting[]>(() => {
    if (live) {
      return live.sightings.map((s) => ({
        id: s.id,
        lot: s.lot,
        scout: s.scout,
        at: s.at,
        mine: s.userId === live.userId,
      }));
    }
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
  }, [live, openedAt, state.reports]);

  const reports = live ? live.myReports : state.reports;

  const leaderboard = useMemo(() => {
    if (live) return live.leaderboard;
    const demoPoints = BASE_POINTS + state.reports.length * POINTS_PER_REPORT;
    return rankLeaderboard(
      OTHER_SCOUTS.map((scout) => ({ name: scout.name, points: scout.points, you: false })),
      { name: "You", points: demoPoints },
    );
  }, [live, state.reports.length]);

  const you = leaderboard.find((row) => row.you);
  const points = you?.points ?? 0;
  const rank = you?.rank ?? leaderboard.length + 1;

  const badges = useMemo(() => {
    const earned = new Set<BadgeId>();
    const reportedLots = new Set(reports.map((r) => r.lot));
    if (reports.length >= 1) earned.add("first-signal");
    if (reports.length >= 3) earned.add("hat-trick");
    if (LOT_IDS.every((id) => reportedLots.has(id))) earned.add("campus-wide");
    if (state.payments.length > 0) earned.add("just-in-time");
    return earned;
  }, [reports, state.payments]);

  const statusFor = useCallback(
    (lotId: LotId): LotStatus => {
      const nowMs = now.getTime();
      const lastSighting = sightings.find((s) => s.lot === lotId) ?? null;
      const spotted =
        lastSighting !== null && nowMs - lastSighting.at < SPOTTED_WINDOW_MINUTES * MINUTE;
      const lastMine = reports
        .filter((r) => r.lot === lotId)
        .reduce<Report | undefined>(
          (latest, r) => (!latest || r.at > latest.at ? r : latest),
          undefined,
        );
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
    [now, sightings, reports, state.payments],
  );

  const value = useMemo<StoreValue>(
    () => ({
      mode: live ? "live" : "demo",
      loading: live?.loading ?? false,
      now,
      selected: state.selected,
      reports,
      payments: state.payments,
      sightings,
      leaderboard,
      points,
      badges,
      rank,
      needsName: live !== null && live.scoutName === null,
      statusFor,
      select: (lot) => dispatch({ type: "select", lot }),
      report: async (lot, scoutName) => {
        if (live) {
          const report = await live.report(lot, scoutName);
          refreshNow();
          return report;
        }
        const report = { id: `r-${Date.now().toString(36)}`, lot, at: Date.now() };
        dispatch({ type: "report", report });
        refreshNow();
        return report;
      },
      undoReport: async (id) => {
        if (live) return live.undoReport(id);
        dispatch({ type: "undo-report", id });
      },
      pay: (lot) => {
        dispatch({ type: "pay", lot, at: Date.now() });
        refreshNow();
      },
      reset: () => dispatch({ type: "reset" }),
    }),
    [
      live,
      now,
      refreshNow,
      state,
      reports,
      sightings,
      leaderboard,
      points,
      badges,
      rank,
      statusFor,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside <StoreProvider>");
  return store;
}
