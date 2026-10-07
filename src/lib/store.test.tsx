import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BASE_POINTS, OTHER_SCOUTS, POINTS_PER_REPORT, REPORT_COOLDOWN_MINUTES } from "./community";
import { StoreProvider, useStore } from "./store";

const wrapper = ({ children }: { children: ReactNode }) => (
  <StoreProvider>{children}</StoreProvider>
);

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-05T12:20:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("store", () => {
  it("starts on P9 with base points", () => {
    const { result } = renderHook(useStore, { wrapper });
    expect(result.current.selected).toBe("P9");
    expect(result.current.points).toBe(BASE_POINTS);
    expect(result.current.rank).toBe(OTHER_SCOUTS.length + 1);
  });

  it("reporting adds clout, marks the lot spotted and starts a cooldown", () => {
    const { result } = renderHook(useStore, { wrapper });
    expect(result.current.statusFor("P9").spotted).toBe(false);

    act(() => void result.current.report("P9"));

    expect(result.current.points).toBe(BASE_POINTS + POINTS_PER_REPORT);
    const status = result.current.statusFor("P9");
    expect(status.spotted).toBe(true);
    expect(status.tone).toBe("high");
    expect(status.cooldownMinutes).toBe(REPORT_COOLDOWN_MINUTES);
    expect(result.current.sightings[0]).toMatchObject({ lot: "P9", mine: true });
    expect(result.current.badges.has("first-signal")).toBe(true);
  });

  it("undo removes the report and its points", () => {
    const { result } = renderHook(useStore, { wrapper });
    let id = "";
    act(() => {
      id = result.current.report("P4").id;
    });
    act(() => result.current.undoReport(id));
    expect(result.current.points).toBe(BASE_POINTS);
    expect(result.current.statusFor("P4").cooldownMinutes).toBe(0);
  });

  it("paying twice extends the session instead of duplicating it", () => {
    const { result } = renderHook(useStore, { wrapper });
    act(() => result.current.pay("P9"));
    act(() => result.current.pay("P9"));
    expect(result.current.payments).toHaveLength(1);
    const session = result.current.statusFor("P9").session!;
    expect(session.until - session.at).toBe(60 * 60_000);
  });

  it("persists progress across reloads and ignores corrupt storage", () => {
    const first = renderHook(useStore, { wrapper });
    act(() => {
      first.result.current.select("IC");
      first.result.current.report("IC");
    });
    first.unmount();

    const second = renderHook(useStore, { wrapper });
    expect(second.result.current.selected).toBe("IC");
    expect(second.result.current.reports).toHaveLength(1);
    second.unmount();

    window.localStorage.setItem("lotpulse:v1", "{not json");
    const third = renderHook(useStore, { wrapper });
    expect(third.result.current.reports).toHaveLength(0);
  });

  it("reset clears progress but keeps the selected lot", () => {
    const { result } = renderHook(useStore, { wrapper });
    act(() => {
      result.current.select("P8");
      result.current.report("P8");
      result.current.pay("P8");
    });
    act(() => result.current.reset());
    expect(result.current.points).toBe(BASE_POINTS);
    expect(result.current.payments).toHaveLength(0);
    expect(result.current.selected).toBe("P8");
  });
});
