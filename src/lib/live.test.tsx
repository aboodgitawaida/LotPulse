import { act, renderHook, waitFor } from "@testing-library/react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { rankLeaderboard } from "./community";
import { friendlyError, parseSighting, useLiveCommunity, weekStart } from "./live";

interface Query {
  table: string;
  op: "select" | "insert" | "delete";
  values?: Record<string, unknown>;
  filters: Record<string, unknown>;
}

type Result = { data?: unknown; error?: { message: string } | null };

/** Just enough of the Supabase client for useLiveCommunity. */
function fakeSupabase(respond: (query: Query) => Result) {
  const queries: Query[] = [];
  const from = (table: string) => {
    const query: Query = { table, op: "select", filters: {} };
    const builder: Record<string, unknown> = new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === "then") {
            queries.push(query);
            const result = respond(query);
            return (resolve: (value: Result) => void) =>
              resolve({ data: result.data ?? null, error: result.error ?? null });
          }
          if (prop === "insert") {
            return (values: Record<string, unknown>) => {
              query.op = "insert";
              query.values = values;
              return builder;
            };
          }
          if (prop === "delete") {
            return () => {
              query.op = "delete";
              return builder;
            };
          }
          if (prop === "eq") {
            return (column: string, value: unknown) => {
              query.filters[column] = value;
              return builder;
            };
          }
          return () => builder;
        },
      },
    );
    return builder;
  };
  const channel = { on: () => channel, subscribe: () => channel };
  const client = {
    from,
    channel: () => channel,
    removeChannel: async () => "ok",
    auth: {
      getSession: async () => ({ data: { session: null } }),
      signInAnonymously: async () => ({ data: { user: { id: "me" } }, error: null }),
    },
  };
  return { client: client as unknown as SupabaseClient, queries };
}

const recent = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();

describe("live helpers", () => {
  it("parses API rows and rejects bad ones", () => {
    expect(
      parseSighting({
        id: "a",
        lot_id: "P4",
        user_id: "u",
        created_at: "2026-10-05T12:00:00Z",
        profiles: { username: "deck_runner" },
      }),
    ).toMatchObject({ id: "a", lot: "P4", scout: "deck_runner" });
    expect(parseSighting({ id: "a", lot_id: "P99", user_id: "u", created_at: "x" })).toBeNull();
    expect(parseSighting(null)).toBeNull();
  });

  it("explains database errors in plain language", () => {
    expect(friendlyError({ message: "cooldown: you reported this lot" })).toMatch(/15 minutes/);
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
      if (query.table === "sightings" && query.op === "select") {
        return {
          data: [
            {
              id: "s1",
              lot_id: "IC",
              user_id: "other",
              created_at: recent(5),
              profiles: { username: "deck_runner" },
            },
          ],
        };
      }
      if (query.table === "sightings" && query.op === "insert") {
        return { data: { id: "s2", lot_id: "P9", user_id: "me", created_at: recent(0) } };
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

  it("surfaces cooldowns and expired undo windows as readable errors", async () => {
    const { client } = fakeSupabase((query) => {
      if (query.table === "sightings" && query.op === "insert") {
        return { error: { message: "cooldown: you reported this lot in the last 15 minutes" } };
      }
      if (query.table === "sightings" && query.op === "delete") return { data: [] };
      return { data: [] };
    });
    const { result } = renderHook(() => useLiveCommunity(client));
    await waitFor(() => expect(result.current?.loading).toBe(false));

    await expect(result.current!.report("P4", "night_owl")).rejects.toThrow(/15 minutes/);
    await expect(result.current!.undoReport("old")).rejects.toThrow(/Too late to undo/);
  });
});
