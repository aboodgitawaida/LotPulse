// App state. Reports, clout and the leaderboard come from Supabase (see
// src/lib/live.ts); without Supabase credentials the app is "offline" and shows
// no reports at all rather than made-up ones. Lot selection is local.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { LOT_IDS, RISK_WINDOW_MINUTES, isLotId, riskFor, type LotId, type Tone } from "./lots";
import { REPORT_COOLDOWN_MINUTES, type BadgeId, type LeaderboardRow } from "./community";
import { useLiveCommunity } from "./live";
import { supabase } from "./supabase";

const STORAGE_KEY = "lotpulse:v1";
const MINUTE = 60_000;
const DEFAULT_LOT: LotId = "P9";

export interface Report {
  id: string;
  lot: LotId;
  at: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function loadSelected(): LotId {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isRecord(parsed) && isLotId(parsed["selected"]) ? parsed["selected"] : DEFAULT_LOT;
  } catch {
    return DEFAULT_LOT;
  }
}

function saveSelected(selected: LotId) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ selected }));
  } catch {
    // Private mode or storage disabled: the choice just won't survive a refresh.
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
  /** Reports for this lot in the last RISK_WINDOW_MINUTES. */
  recentReports: number;
  tone: Tone;
  /** The most recent report for this lot, if it's within the feed window. */
  lastSighting: Sighting | null;
  /** At least one recent report. */
  spotted: boolean;
  /** Minutes until this scout may report the lot again (0 = can report). */
  cooldownMinutes: number;
}

interface StoreValue {
  /** "offline" when Supabase isn't configured: no reports, reporting disabled. */
  mode: "live" | "offline";
  /** True until the first reports load. */
  loading: boolean;
  /** Reports couldn't be loaded (offline, Supabase down); retrying. */
  unreachable: boolean;
  now: Date;
  selected: LotId;
  /** Your reports this week. */
  reports: Report[];
  /** Everyone's reports from the last 24 hours, newest first. */
  sightings: Sighting[];
  leaderboard: LeaderboardRow[];
  points: number;
  badges: Set<BadgeId>;
  rank: number;
  /** You still need to pick a public scout name before reporting. */
  needsName: boolean;
  statusFor: (lot: LotId) => LotStatus;
  select: (lot: LotId) => void;
  /** Rejects with a user-facing message (cooldown, rate limit, taken name…). */
  report: (lot: LotId, scoutName?: string, captchaToken?: string) => Promise<Report>;
}

const StoreContext = createContext<StoreValue | null>(null);

/** Re-render on a fixed tick so "min ago", cooldowns and risk levels stay current. */
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

export function StoreProvider({
  children,
  client = supabase,
}: {
  children: ReactNode;
  /** Defaults to the configured Supabase client; tests pass a fake. */
  client?: SupabaseClient | null;
}) {
  const [selected, setSelected] = useState<LotId>(loadSelected);
  // Actions refresh the clock so derived values (cooldowns) are exact.
  const [now, refreshNow] = useNow();

  useEffect(() => saveSelected(selected), [selected]);

  const live = useLiveCommunity(client);

  const sightings = useMemo<Sighting[]>(
    () =>
      (live?.sightings ?? []).map((s) => ({
        id: s.id,
        lot: s.lot,
        scout: s.scout,
        at: s.at,
        mine: s.userId !== "" && s.userId === live?.userId,
      })),
    [live],
  );

  const reports = useMemo(() => live?.myReports ?? [], [live]);
  const leaderboard = useMemo(() => live?.leaderboard ?? [], [live]);

  const you = leaderboard.find((row) => row.you);
  const points = you?.points ?? 0;
  const rank = you?.rank ?? leaderboard.length + 1;

  const badges = useMemo(() => {
    const earned = new Set<BadgeId>();
    const reportedLots = new Set(reports.map((r) => r.lot));
    if (reports.length >= 1) earned.add("first-signal");
    if (reports.length >= 3) earned.add("hat-trick");
    if (LOT_IDS.every((id) => reportedLots.has(id))) earned.add("campus-wide");
    return earned;
  }, [reports]);

  const statusFor = useCallback(
    (lotId: LotId): LotStatus => {
      const nowMs = now.getTime();
      // Sightings are sorted newest first.
      const forLot = sightings.filter((s) => s.lot === lotId);
      const lastSighting = forLot[0] ?? null;
      const recentReports = forLot.filter(
        (s) => nowMs - s.at < RISK_WINDOW_MINUTES * MINUTE,
      ).length;
      const lastMine = reports
        .filter((r) => r.lot === lotId)
        .reduce<Report | undefined>(
          (latest, r) => (!latest || r.at > latest.at ? r : latest),
          undefined,
        );
      const cooldownMs = lastMine ? lastMine.at + REPORT_COOLDOWN_MINUTES * MINUTE - nowMs : 0;
      return {
        recentReports,
        tone: riskFor(recentReports),
        lastSighting,
        spotted: recentReports > 0,
        cooldownMinutes: cooldownMs > 0 ? Math.ceil(cooldownMs / MINUTE) : 0,
      };
    },
    [now, sightings, reports],
  );

  const value = useMemo<StoreValue>(
    () => ({
      mode: live ? "live" : "offline",
      loading: live?.loading ?? false,
      unreachable: live?.unreachable ?? false,
      now,
      selected,
      reports,
      sightings,
      leaderboard,
      points,
      badges,
      rank,
      needsName: live !== null && live.scoutName === null,
      statusFor,
      select: setSelected,
      report: async (lot, scoutName, captchaToken) => {
        if (!live) {
          throw new Error("Reporting isn't connected on this site yet, so nothing was sent.");
        }
        const report = await live.report(lot, scoutName, captchaToken);
        refreshNow();
        return report;
      },
    }),
    [
      live,
      now,
      refreshNow,
      selected,
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
