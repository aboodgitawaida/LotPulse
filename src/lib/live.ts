// Live community data from Supabase: everyone's recent reports (kept current
// over Realtime), the weekly leaderboard and this scout's own reports. Needs
// the Supabase credentials in src/lib/supabase.ts.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { rankLeaderboard, type LeaderboardRow } from "./community";
import { isLotId, type LotId } from "./lots";

const DAY = 86_400_000;
/** How far back the live feed (and the last report per lot) looks. */
export const FEED_WINDOW_MS = DAY;

export interface LiveFeedReport {
  id: string;
  lot: LotId;
  userId: string;
  scout: string;
  at: number;
}

export interface LiveReport {
  id: string;
  lot: LotId;
  at: number;
}

export interface LiveCommunity {
  loading: boolean;
  /** The last load failed (offline, Supabase down). Retried automatically. */
  unreachable: boolean;
  userId: string | null;
  scoutName: string | null;
  feed: LiveFeedReport[];
  /** This scout's reports since Monday. */
  myReports: LiveReport[];
  leaderboard: LeaderboardRow[];
  report: (lot: LotId, scoutName?: string, captchaToken?: string) => Promise<LiveReport>;
  /** Delete this scout's reports, name and anonymous account, then start fresh. */
  deleteMyData: () => Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Monday 00:00 local time, matching the database's Toronto-time week. */
export function weekStart(now: Date): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

/** Validate a reports row (optionally with an embedded profile) from the API. */
export function parseReport(row: unknown, fallbackScout = "scout"): LiveFeedReport | null {
  if (!isRecord(row)) return null;
  const { id, lot_id: lot, reporter_id: reporterId, created_at: createdAt, profiles } = row;
  if (typeof id !== "string" || typeof createdAt !== "string") return null;
  // A report outlives its scout's deleted profile, without a reporter.
  const userId = typeof reporterId === "string" ? reporterId : "";
  if (!isLotId(lot)) return null;
  const at = Date.parse(createdAt);
  if (Number.isNaN(at)) return null;
  const scout =
    isRecord(profiles) && typeof profiles["username"] === "string"
      ? profiles["username"]
      : fallbackScout;
  return { id, lot, userId, scout, at };
}

interface BoardEntry {
  userId: string;
  username: string;
  points: number;
}

function parseBoardEntry(row: unknown): BoardEntry | null {
  if (!isRecord(row)) return null;
  const { user_id: userId, username, points } = row;
  if (typeof userId !== "string" || typeof username !== "string" || typeof points !== "number") {
    return null;
  }
  return { userId, username, points };
}

/** Turn database and auth errors into something a student can act on. */
export function friendlyError(error: unknown): string {
  const message = isRecord(error) && typeof error["message"] === "string" ? error["message"] : "";
  if (message.includes("cooldown")) return "You already reported this lot in the last 5 minutes.";
  if (message.includes("rate_limit")) return "That's a lot of reports. Try again in a bit.";
  if (message.includes("profiles_username_unique")) return "That scout name is taken.";
  if (message.includes("profiles_username_reserved")) {
    return "That name is reserved. Pick a different scout name.";
  }
  if (message.includes("profiles_username_format")) {
    return "Scout names are 3–20 letters, numbers or underscores.";
  }
  if (/captcha/i.test(message)) return "The bot check didn't go through. Please try it again.";
  if (/anonymous sign-ins are disabled/i.test(message)) {
    return "Reporting isn't switched on yet. Anonymous sign-ins are disabled in Supabase.";
  }
  if (/fetch|network/i.test(message)) return "Couldn't reach LotPulse. Check your connection.";
  return "Something went wrong. Please try again.";
}

const REPORT_COLUMNS = "id, lot_id, reporter_id, created_at";
/**
 * Every open tab hears every report, so leaderboard refreshes after realtime
 * events are batched and spread out instead of all hitting the API at once.
 */
const BOARD_REFRESH_MS = 3_000;
/** How long to wait before retrying after reports failed to load. */
const RETRY_MS = 15_000;

export function useLiveCommunity(client: SupabaseClient | null): LiveCommunity | null {
  const [loading, setLoading] = useState(true);
  const [unreachable, setUnreachable] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [scoutName, setScoutName] = useState<string | null>(null);
  const [feed, setFeed] = useState<LiveFeedReport[]>([]);
  const [myReports, setMyReports] = useState<LiveReport[]>([]);
  const [board, setBoard] = useState<BoardEntry[]>([]);
  const names = useRef(new Map<string, string>());
  const userIdRef = useRef<string | null>(null);

  const addReport = useCallback((entry: LiveFeedReport) => {
    if (entry.userId) names.current.set(entry.userId, entry.scout);
    setFeed((previous) =>
      previous.some((s) => s.id === entry.id)
        ? previous
        : [entry, ...previous].sort((a, b) => b.at - a.at),
    );
    if (entry.userId === userIdRef.current) {
      setMyReports((previous) =>
        previous.some((r) => r.id === entry.id)
          ? previous
          : [...previous, { id: entry.id, lot: entry.lot, at: entry.at }],
      );
    }
  }, []);

  const refreshBoard = useCallback(async () => {
    if (!client) return;
    const { data } = await client.rpc("weekly_leaderboard");
    if (Array.isArray(data)) {
      setBoard(data.map(parseBoardEntry).filter((row): row is BoardEntry => row !== null));
    }
  }, [client]);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    let boardTimer: number | undefined;
    let retryTimer: number | undefined;
    const scheduleBoard = () => {
      if (boardTimer !== undefined) return;
      boardTimer = window.setTimeout(
        () => {
          boardTimer = undefined;
          if (!cancelled) void refreshBoard();
        },
        BOARD_REFRESH_MS * (0.5 + Math.random()),
      );
    };

    const load = async () => {
      const { data: auth } = await client.auth.getSession();
      const uid = auth.session?.user.id ?? null;
      const since = new Date(Date.now() - FEED_WINDOW_MS).toISOString();
      const [feedResult, profile, mine] = await Promise.all([
        client
          .from("reports")
          .select(`${REPORT_COLUMNS}, profiles(username)`)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(200),
        uid ? client.from("profiles").select("username").eq("id", uid).maybeSingle() : null,
        uid
          ? client
              .from("reports")
              .select(REPORT_COLUMNS)
              .eq("reporter_id", uid)
              .gte("created_at", weekStart(new Date()).toISOString())
          : null,
        refreshBoard(),
      ]);
      if (cancelled) return;
      // A failed load is not "no reports": never let it show lots as clear.
      if (feedResult.error) throw feedResult.error;

      userIdRef.current = uid;
      setUserId(uid);
      const name =
        isRecord(profile?.data) && typeof profile.data["username"] === "string"
          ? profile.data["username"]
          : null;
      setScoutName(name);
      const parsed = (feedResult.data ?? [])
        .map((row: unknown) => parseReport(row))
        .filter((s: LiveFeedReport | null): s is LiveFeedReport => s !== null);
      for (const s of parsed) if (s.userId) names.current.set(s.userId, s.scout);
      // Keep anything Realtime delivered while this was loading.
      setFeed((previous) => {
        const ids = new Set(parsed.map((s) => s.id));
        return [...parsed, ...previous.filter((s) => !ids.has(s.id))].sort((a, b) => b.at - a.at);
      });
      setMyReports(
        (mine?.data ?? [])
          .map((row: unknown) => parseReport(row))
          .filter((s: LiveFeedReport | null): s is LiveFeedReport => s !== null)
          .map(({ id, lot, at }: LiveFeedReport) => ({ id, lot, at })),
      );
      setLoading(false);
    };

    const reload = () => {
      window.clearTimeout(retryTimer);
      retryTimer = undefined;
      void load().then(
        () => {
          if (!cancelled) setUnreachable(false);
        },
        () => {
          if (cancelled) return;
          setLoading(false);
          setUnreachable(true);
          retryTimer = window.setTimeout(reload, RETRY_MS);
        },
      );
    };
    reload();

    // Phones suspend background tabs and realtime misses events while asleep,
    // so catch up whenever the app comes back into view.
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 30_000) reload();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Every open device hears every new report within a second or two.
    let subscribedBefore = false;
    const channel = client
      .channel("public:reports")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reports" },
        (payload) => {
          const row: unknown = payload.new;
          const userIdOfRow =
            isRecord(row) && typeof row["reporter_id"] === "string" ? row["reporter_id"] : "";
          const known = names.current.get(userIdOfRow);
          const finish = (scout: string) => {
            const entry = parseReport(row, scout);
            if (entry && !cancelled) addReport(entry);
            scheduleBoard();
          };
          if (known || !userIdOfRow) {
            finish(known ?? "scout");
            return;
          }
          void client
            .from("profiles")
            .select("username")
            .eq("id", userIdOfRow)
            .maybeSingle()
            .then(({ data }) =>
              finish(
                isRecord(data) && typeof data["username"] === "string" ? data["username"] : "scout",
              ),
            );
        },
      )
      .subscribe((status) => {
        // After a dropped connection, fetch whatever was missed meanwhile.
        if (status !== "SUBSCRIBED") return;
        if (subscribedBefore) reload();
        subscribedBefore = true;
      });

    return () => {
      cancelled = true;
      window.clearTimeout(boardTimer);
      window.clearTimeout(retryTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      void client.removeChannel(channel);
    };
  }, [client, addReport, refreshBoard]);

  const report = useCallback(
    async (lot: LotId, requestedName?: string, captchaToken?: string): Promise<LiveReport> => {
      if (!client) throw new Error("Live reporting isn't configured.");

      let uid = userIdRef.current;
      let name = scoutName;
      if (!uid) {
        // Reports may not have loaded yet (slow network, or the load failed), so
        // reuse a saved sign-in instead of creating a second scout.
        const { data } = await client.auth.getSession();
        const savedId = data.session?.user.id;
        if (savedId) {
          uid = savedId;
          userIdRef.current = uid;
          setUserId(uid);
          const { data: profile } = await client
            .from("profiles")
            .select("username")
            .eq("id", uid)
            .maybeSingle();
          if (isRecord(profile) && typeof profile["username"] === "string") {
            name = profile["username"];
            setScoutName(name);
          }
        }
      }
      if (!uid) {
        const { data, error } = await client.auth.signInAnonymously(
          captchaToken ? { options: { captchaToken } } : undefined,
        );
        if (error || !data.user) throw new Error(friendlyError(error));
        uid = data.user.id;
        userIdRef.current = uid;
        setUserId(uid);
      }

      if (!name) {
        const wanted = requestedName?.trim();
        if (!wanted) throw new Error("Pick a scout name first.");
        const { error } = await client.from("profiles").insert({ id: uid, username: wanted });
        if (error) throw new Error(friendlyError(error));
        name = wanted;
        setScoutName(wanted);
      }

      const { data, error } = await client
        .from("reports")
        .insert({ lot_id: lot })
        .select(REPORT_COLUMNS)
        .single();
      if (error) throw new Error(friendlyError(error));
      const entry = parseReport(data, name);
      if (!entry) throw new Error(friendlyError(null));
      addReport(entry);
      void refreshBoard();
      return { id: entry.id, lot: entry.lot, at: entry.at };
    },
    [client, scoutName, addReport, refreshBoard],
  );

  const deleteMyData = useCallback(async () => {
    const uid = userIdRef.current;
    if (!client || !uid) return;
    const { error } = await client.rpc("delete_my_data");
    if (error) throw new Error(friendlyError(error));
    // The account is gone on the server; just forget it in this browser.
    await client.auth.signOut({ scope: "local" });
    userIdRef.current = null;
    setUserId(null);
    setScoutName(null);
    setMyReports([]);
    setFeed((previous) => previous.filter((s) => s.userId !== uid));
    names.current.delete(uid);
    void refreshBoard();
  }, [client, refreshBoard]);

  const leaderboard = useMemo(
    () =>
      rankLeaderboard(
        board.map((row) => ({
          name: row.username,
          points: row.points,
          you: row.userId === userId,
        })),
        // Show yourself even before your first report this week.
        scoutName && !board.some((row) => row.userId === userId)
          ? { name: scoutName, points: 0 }
          : null,
      ),
    [board, userId, scoutName],
  );

  return useMemo(
    () =>
      client
        ? {
            loading,
            unreachable,
            userId,
            scoutName,
            feed,
            myReports,
            leaderboard,
            report,
            deleteMyData,
          }
        : null,
    [
      client,
      loading,
      unreachable,
      userId,
      scoutName,
      feed,
      myReports,
      leaderboard,
      report,
      deleteMyData,
    ],
  );
}
