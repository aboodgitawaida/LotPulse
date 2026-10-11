import { describe, expect, it } from "vitest";

import { formatDuration, formatRate, timeAgo } from "./format";
import { LOTS, getLot, riskFor } from "./lots";

const monday = (time: string) => new Date(`2026-10-05T${time}:00`);

describe("lot data", () => {
  it("has a unique id for every lot", () => {
    expect(new Set(LOTS.map((lot) => lot.id)).size).toBe(LOTS.length);
  });
});

describe("riskFor", () => {
  it.each([
    [0, "low"],
    [1, "medium"],
    [2, "high"],
    [7, "high"],
  ] as const)("%i reports in 2 hours is %s", (count, tone) => {
    expect(riskFor(count)).toBe(tone);
  });
});

describe("format helpers", () => {
  it("formats durations", () => {
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(120)).toBe("2h");
    expect(formatDuration(135)).toBe("2h 15m");
  });

  it("formats posted rates", () => {
    expect(formatRate(getLot("P9").rate)).toBe("$3.00 / 30 min · $18 daily max");
    expect(formatRate(getLot("IC").rate)).toBe("$2.75 / 30 min");
  });

  it("formats relative times", () => {
    const now = monday("12:00").getTime();
    expect(timeAgo(now - 20_000, now)).toBe("just now");
    expect(timeAgo(now - 12 * 60_000, now)).toBe("12 min ago");
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe("3h ago");
  });
});
