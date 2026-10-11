import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { rankLeaderboard } from "./community";
import { friendlyError, parseSighting, useLiveCommunity, weekStart } from "./live";
import { fakeSupabase, minutesAgo as recent } from "@/test/fake-supabase";

describe("live helpers", () => {
  it("parses API rows and rejects bad ones", () => {
    expect(
      parseSighting({
        id: "a",
        lot_id: "P4",
        reporter_id: "u",
        created_at: "2026-10-05T12:00:00Z",
        profiles: { username: "deck_runner" },
      }),
    ).toMatchObject({ id: "a", lot: "P4", scout: "deck_runner" });
    expect(parseSighting({ id: "a", lot_id: "P99", reporter_id: "u", created_at: "x" })).toBeNull();
    // Reports whose scout deleted their profile have no reporter.
    expect(
      parseSighting({
        id: "b",
        lot_id: "P9",
        reporter_id: null,
        created_at: "2026-10-05T12:00:00Z",
      }),
    ).toMatchObject({ id: "b", userId: "", scout: "scout" });
    expect(parseSighting(null)).toBeNull();
  });

  it("explains database errors in plain language", () => {
    expect(friendlyError({ message: "cooldown: you reported this lot" })).toMatch(/5 minutes/);
    expect(friendlyError({ message: "rate_limit: too many" })).toMatch(/Try again/);
    expect(friendlyError({ message: 'violates "profiles_username_unique"' })).toMatch(/taken/);
    expect(friendlyError({ message: "Anonymous sign-ins are disabled" })).toMatch(/switched on/);
    expect(friendlyError(undefined)).toMatch(/try again/i);
  });

  it("starts the week on Monday", () => {
    expect(weekStart(new Date("2026-10-07T15:00:00")).toString()).toBe(
      new Date("2026-10-05T00:00:00").toString(),
    );
    expect(weekStart(new Date("2026-10-11T23:00:00")).getDate()).toBe(5);
  });

  it("ranks the leaderboard with you first on ties", () => {
    const rows = rankLeaderboard([{ name: "a", points: 50, you: false }], {
      name: "me",
      points: 50,
    });
    expect(rows.map((r) => [r.name, r.rank])).toEqual([
      ["me", 1],
      ["a", 2],
    ]);
  });
});

describe("useLiveCommunity", () => {
  it("is disabled without a client", () => {
    const { result } = renderHook(() => useLiveCommunity(null));
    expect(result.current).toBeNull();
  });

  it("loads the feed and leaderboard, then reports with a new scout name", async () => {
    const { client, queries } = fakeSupabase((query) => {
      if (query.table === "weekly_leaderboard") {
        return { data: [{ user_id: "other", username: "deck_runner", points: 50 }] };
      }
      if (query.table === "reports" && query.op === "select") {
        return {
          data: [
            {
              id: "s1",
              lot_id: "IC",
              reporter_id: "other",
              created_at: recent(5),
              profiles: { username: "deck_runner" },
            },
          ],
        };
      }
      if (query.table === "reports" && query.op === "insert") {
        return { data: { id: "s2", lot_id: "P9", reporter_id: "me", created_at: recent(0) } };
      }
      return {};
    });

    const { result } = renderHook(() => useLiveCommunity(client));
    await waitFor(() => expect(result.current?.loading).toBe(false));
    expect(result.current?.sightings.map((s) => s.scout)).toEqual(["deck_runner"]);
    expect(result.current?.scoutName).toBeNull();

    await expect(result.current!.report("P9")).rejects.toThrow(/scout name/);

    await act(async () => {
      await result.current!.report("P9", "night_owl");
    });
    expect(queries).toContainEqual(
      expect.objectContaining({
        table: "profiles",
        op: "insert",
        values: { id: "me", username: "night_owl" },
      }),
    );
    expect(result.current?.scoutName).toBe("night_owl");
    expect(result.current?.myReports).toEqual([expect.objectContaining({ id: "s2", lot: "P9" })]);
    expect(result.current?.sightings[0]).toMatchObject({ id: "s2", scout: "night_owl" });
    expect(result.current?.leaderboard.find((row) => row.you)?.name).toBe("night_owl");
  });

  it("surfaces the cooldown as a readable error", async () => {
    const { client } = fakeSupabase((query) => {
      if (query.table === "reports" && query.op === "insert") {
        return { error: { message: "cooldown: you reported this lot in the last 5 minutes" } };
      }
      return { data: [] };
    });
    const { result } = renderHook(() => useLiveCommunity(client));
    await waitFor(() => expect(result.current?.loading).toBe(false));

    await expect(result.current!.report("P4", "night_owl")).rejects.toThrow(/5 minutes/);
  });

  it("adds reports from other devices as they arrive over Realtime", async () => {
    const { client, emitInsert } = fakeSupabase((query) => {
      if (query.table === "profiles") return { data: { username: "deck_runner" } };
      return { data: [] };
    });
    const { result } = renderHook(() => useLiveCommunity(client));
    await waitFor(() => expect(result.current?.loading).toBe(false));
    expect(result.current?.sightings).toEqual([]);

    act(() =>
      emitInsert("reports", {
        id: "s9",
        lot_id: "P9",
        reporter_id: "other",
        created_at: recent(0),
      }),
    );
    await waitFor(() =>
      expect(result.current?.sightings).toEqual([
        expect.objectContaining({ id: "s9", lot: "P9", scout: "deck_runner" }),
      ]),
    );

    // The same report arriving twice (Realtime + reload) is shown once.
    act(() =>
      emitInsert("reports", {
        id: "s9",
        lot_id: "P9",
        reporter_id: "other",
        created_at: recent(0),
      }),
    );
    await waitFor(() => expect(result.current?.sightings).toHaveLength(1));
  });
});
