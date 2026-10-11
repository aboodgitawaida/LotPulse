import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { fakeSupabase, minutesAgo } from "@/test/fake-supabase";
import { POINTS_PER_REPORT, REPORT_COOLDOWN_MINUTES } from "./community";
import { StoreProvider, useStore } from "./store";

beforeEach(() => {
  window.localStorage.clear();
});

const offline = ({ children }: { children: ReactNode }) => (
  <StoreProvider client={null}>{children}</StoreProvider>
);

/** A Supabase backend holding `reports` (all by "other" unless given). */
function backend(reports: { id: string; lot: string; minutesAgo: number }[]) {
  let board: { user_id: string; username: string; points: number }[] = [];
  const fake = fakeSupabase((query) => {
    if (query.table === "weekly_leaderboard") return { data: board };
    if (query.table === "profiles") return { data: { username: "deck_runner" } };
    if (query.table === "reports" && query.op === "insert") {
      board = [{ user_id: "me", username: "night_owl", points: POINTS_PER_REPORT }];
      return {
        data: {
          id: "mine",
          lot_id: query.values?.["lot_id"],
          reporter_id: "me",
          created_at: minutesAgo(0),
        },
      };
    }
    if (query.table === "reports") {
      return {
        data: reports.map((r) => ({
          id: r.id,
          lot_id: r.lot,
          reporter_id: "other",
          created_at: minutesAgo(r.minutesAgo),
          profiles: { username: "deck_runner" },
        })),
      };
    }
    return {};
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StoreProvider client={fake.client}>{children}</StoreProvider>
  );
  return { ...fake, wrapper };
}

describe("store without Supabase", () => {
  it("shows no made-up reports, points or scouts", () => {
    const { result } = renderHook(useStore, { wrapper: offline });
    expect(result.current.mode).toBe("offline");
    expect(result.current.selected).toBe("P9");
    expect(result.current.sightings).toEqual([]);
    expect(result.current.leaderboard).toEqual([]);
    expect(result.current.points).toBe(0);
    expect(result.current.statusFor("P9")).toMatchObject({
      recentReports: 0,
      tone: "low",
      lastSighting: null,
    });
  });

  it("refuses to report instead of pretending", async () => {
    const { result } = renderHook(useStore, { wrapper: offline });
    await expect(result.current.report("P9")).rejects.toThrow(/isn't connected/);
  });

  it("remembers the selected lot and ignores corrupt storage", () => {
    const first = renderHook(useStore, { wrapper: offline });
    act(() => first.result.current.select("IC"));
    first.unmount();
    expect(renderHook(useStore, { wrapper: offline }).result.current.selected).toBe("IC");

    window.localStorage.setItem("lotpulse:v1", "{not json");
    expect(renderHook(useStore, { wrapper: offline }).result.current.selected).toBe("P9");
  });
});

describe("store with Supabase", () => {
  it("rates each lot by its reports in the last 2 hours", async () => {
    const { wrapper } = backend([
      { id: "a", lot: "P9", minutesAgo: 10 },
      { id: "b", lot: "P9", minutesAgo: 90 },
      { id: "c", lot: "P4", minutesAgo: 30 },
      { id: "d", lot: "IC", minutesAgo: 180 },
    ]);
    const { result } = renderHook(useStore, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.statusFor("P9")).toMatchObject({ recentReports: 2, tone: "high" });
    expect(result.current.statusFor("P9").lastSighting?.id).toBe("a");
    expect(result.current.statusFor("P4")).toMatchObject({ recentReports: 1, tone: "medium" });
    // Too old to count towards risk, but still the last sighting.
    expect(result.current.statusFor("IC")).toMatchObject({
      recentReports: 0,
      tone: "low",
      spotted: false,
    });
    expect(result.current.statusFor("IC").lastSighting?.id).toBe("d");
    expect(result.current.statusFor("P8").lastSighting).toBeNull();
  });

  it("updates a lot when another device reports it", async () => {
    const { wrapper, emitInsert } = backend([]);
    const { result } = renderHook(useStore, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.statusFor("P9").tone).toBe("low");

    act(() =>
      emitInsert("reports", {
        id: "x",
        lot_id: "P9",
        reporter_id: "other",
        created_at: minutesAgo(0),
      }),
    );
    await waitFor(() =>
      expect(result.current.statusFor("P9")).toMatchObject({ recentReports: 1, tone: "medium" }),
    );
    expect(result.current.statusFor("P9").lastSighting).toMatchObject({
      scout: "deck_runner",
      mine: false,
    });
  });

  it("reporting saves a report, earns clout and starts the cooldown", async () => {
    const { wrapper, queries } = backend([]);
    const { result } = renderHook(useStore, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.needsName).toBe(true);

    await act(async () => {
      await result.current.report("P9", "night_owl");
    });

    expect(queries).toContainEqual(
      expect.objectContaining({ table: "reports", op: "insert", values: { lot_id: "P9" } }),
    );
    const status = result.current.statusFor("P9");
    expect(status).toMatchObject({ recentReports: 1, spotted: true });
    expect(status.lastSighting).toMatchObject({ mine: true });
    expect(status.cooldownMinutes).toBe(REPORT_COOLDOWN_MINUTES);
    await waitFor(() => expect(result.current.points).toBe(POINTS_PER_REPORT));
    expect(result.current.badges.has("first-signal")).toBe(true);
  });
});
