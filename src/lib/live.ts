// Live community data from Supabase: shared sightings, the weekly leaderboard
// and this scout's own reports. Used instead of the demo data whenever
// Supabase credentials are configured (see src/lib/supabase.ts).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { rankLeaderboard, type LeaderboardRow } from "./community";
import { isLotId, type LotId } from "./lots";

const DAY = 86_400_000;
/** How far back the live feed (and "last sighting" per lot) looks. */
export const FEED_WINDOW_MS = DAY;

export interface LiveSighting {
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
  userId: string | null;
  scoutName: string | null;
  sightings: LiveSighting[];
  /** This scout's sightings since Monday. */
  myReports: LiveReport[];
  leaderboard: LeaderboardRow[];
  report: (lot: LotId, scoutName?: string) => Promise<LiveReport>;
  undoReport: (id: string) => Promise<void>;
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

/** Validate a sightings row (optionally with an embedded profile) from the API. */
export function parseSighting(row: unknown, fallbackScout = "scout"): LiveSighting | null {
  if (!isRecord(row)) return null;
  const { id, lot_id: lot, user_id: userId, created_at: createdAt, profiles } = row;
  if (typeof id !== "string" || typeof userId !== "string" || typeof createdAt !== "string") {
    return null;
  }
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
  if (message.includes("cooldown")) return "You reported this lot in the last 15 minutes.";
  if (message.includes("rate_limit")) return "That's a lot of sightings. Try again in a bit.";
  if (message.includes("profiles_username_unique")) return "That scout name is taken.";
  if (message.includes("profiles_username_format")) {
    return "Scout names are 3–20 letters, numbers or underscores.";
  }
  if (/anonymous sign-ins are disabled/i.test(message)) {
    return "Reporting isn't switched on yet. Anonymous sign-ins are disabled in Supabase.";
  }
  if (/fetch|network/i.test(message)) return "Couldn't reach LotPulse. Check your connection.";
  return "Something went wrong. Please try again.";
}

const SIGHTING_COLUMNS = "id, lot_id, user_id, created_at";

export function useLiveCommunity(client: SupabaseClient | null): LiveCommunity | null {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [scoutName, setScoutName] = useState<string | null>(null);
  const [sightings, setSightings] = useState<LiveSighting[]>([]);
  const [myReports, setMyReports] = useState<LiveReport[]>([]);
  const [board, setBoard] = useState<BoardEntry[]>([]);
  const names = useRef(new Map<string, string>());
  const userIdRef = useRef<string | null>(null);

  const addSighting = useCallback((sighting: LiveSighting) => {
    names.current.set(sighting.userId, sighting.scout);
    setSightings((previous) =>
      previous.some((s) => s.id === sighting.id)
        ? previous
        : [sighting, ...previous].sort((a, b) => b.at - a.at),
    );
    if (sighting.userId === userIdRef.current) {
      setMyReports((previous) =>
        previous.some((r) => r.id === sighting.id)
          ? previous
          : [...previous, { id: sighting.id, lot: sighting.lot, at: sighting.at }],
      );
    }
  }, []);

  const removeSighting = useCallback((id: string) => {
    setSightings((previous) => previous.filter((s) => s.id !== id));
    setMyReports((previous) => previous.filter((r) => r.id !== id));
  }, []);

  const refreshBoard = useCallback(async () => {
    if (!client) return;
    const { data } = await client.from("weekly_leaderboard").select("user_id, username, points");
    if (Array.isArray(data)) {
      setBoard(data.map(parseBoardEntry).filter((row): row is BoardEntry => row !== null));
    }
  }, [client]);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;

    const load = async () => {
      const { data: auth } = await client.auth.getSession();
      const uid = auth.session?.user.id ?? null;
      const since = new Date(Date.now() - FEED_WINDOW_MS).toISOString();
      const [feed, profile, mine] = await Promise.all([
        client
          .from("sightings")
          .select(`${SIGHTING_COLUMNS}, profiles(username)`)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(200),
        uid ? client.from("profiles").select("username").eq("id", uid).maybeSingle() : null,
        uid
          ? client
              .from("sightings")
              .select(SIGHTING_COLUMNS)
              .eq("user_id", uid)
              .gte("created_at", weekStart(new Date()).toISOString())
          : null,
        refreshBoard(),
      ]);
      if (cancelled) return;

      userIdRef.current = uid;
      setUserId(uid);
      const name =
        isRecord(profile?.data) && typeof profile.data["username"] === "string"
          ? profile.data["username"]
          : null;
      setScoutName(name);
      const parsed = (feed.data ?? [])
        .map((row: unknown) => parseSighting(row))
        .filter((s: LiveSighting | null): s is LiveSighting => s !== null);
      for (const s of parsed) names.current.set(s.userId, s.scout);
      setSightings(parsed);
      setMyReports(
        (mine?.data ?? [])
          .map((row: unknown) => parseSighting(row))
          .filter((s: LiveSighting | null): s is LiveSighting => s !== null)
          .map(({ id, lot, at }: LiveSighting) => ({ id, lot, at })),
      );
      setLoading(false);
    };

    void load().catch(() => {
      if (!cancelled) setLoading(false);
    });

    const channel = client
      .channel("public:sightings")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sightings" },
        (payload) => {
          const row: unknown = payload.new;
          const userIdOfRow =
            isRecord(row) && typeof row["user_id"] === "string" ? row["user_id"] : "";
          const known = names.current.get(userIdOfRow);
          const finish = (scout: string) => {
            const sighting = parseSighting(row, scout);
            if (sighting && !cancelled) addSighting(sighting);
            void refreshBoard();
          };
          if (known) {
            finish(known);
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
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "sightings" },
        (payload) => {
          const old: unknown = payload.old;
          if (isRecord(old) && typeof old["id"] === "string") removeSighting(old["id"]);
          void refreshBoard();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void client.removeChannel(channel);
    };
  }, [client, addSighting, removeSighting, refreshBoard]);

  const report = useCallback(
    async (lot: LotId, requestedName?: string): Promise<LiveReport> => {
      if (!client) throw new Error("Live reporting isn't configured.");

      let uid = userIdRef.current;
      if (!uid) {
        const { data, error } = await client.auth.signInAnonymously();
        if (error || !data.user) throw new Error(friendlyError(error));
        uid = data.user.id;
        userIdRef.current = uid;
        setUserId(uid);
      }

      let name = scoutName;
      if (!name) {
        const wanted = requestedName?.trim();
        if (!wanted) throw new Error("Pick a scout name first.");
        const { error } = await client.from("profiles").insert({ id: uid, username: wanted });
        if (error) throw new Error(friendlyError(error));
        name = wanted;
        setScoutName(wanted);
      }

      const { data, error } = await client
        .from("sightings")
        .insert({ lot_id: lot })
        .select(SIGHTING_COLUMNS)
        .single();
      if (error) throw new Error(friendlyError(error));
      const sighting = parseSighting(data, name);
      if (!sighting) throw new Error(friendlyError(null));
      addSighting(sighting);
      void refreshBoard();
      return { id: sighting.id, lot: sighting.lot, at: sighting.at };
    },
    [client, scoutName, addSighting, refreshBoard],
  );

  const undoReport = useCallback(
    async (id: string) => {
      if (!client) return;
      // RLS only lets you delete your own sighting within 2 minutes; outside
      // that window the delete quietly matches nothing.
      const { data, error } = await client.from("sightings").delete().eq("id", id).select("id");
      if (error) throw new Error(friendlyError(error));
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("Too late to undo. Sightings can be undone for 2 minutes.");
      }
      removeSighting(id);
      void refreshBoard();
    },
    [client, removeSighting, refreshBoard],
  );

  const leaderboard = useMemo(
    () =>
      rankLeaderboard(
        board.map((row) => ({
          name: row.username,
          points: row.points,
          you: row.userId === userId,
        })),
        // Show yourself even before your first sighting this week.
        scoutName && !board.some((row) => row.userId === userId)
          ? { name: scoutName, points: 0 }
          : null,
      ),
    [board, userId, scoutName],
  );

  return useMemo(
    () =>
      client
        ? { loading, userId, scoutName, sightings, myReports, leaderboard, report, undoReport }
        : null,
    [client, loading, userId, scoutName, sightings, myReports, leaderboard, report, undoReport],
  );
}
