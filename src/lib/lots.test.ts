import { describe, expect, it } from "vitest";

import { formatDuration, formatHour, formatRate, formatWindow, timeAgo } from "./format";
import { LOTS, dailyForecast, getLot, patrolOutlook, peakWindow, threatAt, toneFor } from "./lots";

// 2026-10-05 is a Monday, 2026-10-10 a Saturday.
const monday = (time: string) => new Date(`2026-10-05T${time}:00`);
const saturday = (time: string) => new Date(`2026-10-10T${time}:00`);

describe("lot data", () => {
  it("has a 24-hour curve and a unique id for every lot", () => {
    for (const lot of LOTS) expect(lot.curve).toHaveLength(24);
    expect(new Set(LOTS.map((lot) => lot.id)).size).toBe(LOTS.length);
  });
});

describe("toneFor", () => {
  it.each([
    [0, "low"],
    [39, "low"],
    [40, "medium"],
    [69, "medium"],
    [70, "high"],
    [100, "high"],
  ] as const)("%i%% is %s", (value, tone) => {
    expect(toneFor(value)).toBe(tone);
  });
});

describe("threatAt", () => {
  const p9 = getLot("P9");

  it("matches the hourly curve on the hour", () => {
    expect(threatAt(p9, monday("14:00"))).toBe(p9.curve[14]);
  });

  it("interpolates between hours", () => {
    const a = p9.curve[12]!;
    const b = p9.curve[13]!;
    expect(threatAt(p9, monday("12:30"))).toBe(Math.round(a + (b - a) / 2));
  });

  it("is much lower on weekends", () => {
    expect(threatAt(p9, saturday("14:00"))).toBeLessThan(threatAt(p9, monday("14:00")) / 2);
  });
});

describe("peakWindow", () => {
  it("spans the hours near the daily maximum", () => {
    const window = peakWindow(dailyForecast(getLot("P9"), monday("09:00")));
    expect(window).toEqual({ start: 13, end: 16, peak: 88 });
  });

  it("returns null on quiet days", () => {
    expect(peakWindow(dailyForecast(getLot("P8"), saturday("09:00")))).toBeNull();
  });
});

describe("patrolOutlook", () => {
  const p9 = getLot("P9");

  it("counts down to an upcoming peak", () => {
    expect(patrolOutlook(p9, monday("12:20"))).toMatchObject({
      kind: "upcoming",
      minutesUntil: 40,
    });
  });

  it("reports an active peak with time left", () => {
    expect(patrolOutlook(p9, monday("15:15"))).toMatchObject({ kind: "active", minutesLeft: 45 });
  });

  it("says when the peak has passed", () => {
    expect(patrolOutlook(p9, monday("20:00")).kind).toBe("passed");
  });

  it("is quiet when there is no peak", () => {
    expect(patrolOutlook(getLot("P8"), saturday("12:00")).kind).toBe("quiet");
  });
});

describe("format helpers", () => {
  it("formats hours and windows", () => {
    expect(formatHour(0)).toBe("12 AM");
    expect(formatHour(13)).toBe("1 PM");
    expect(formatWindow({ start: 13, end: 16 })).toBe("1–4 PM");
    expect(formatWindow({ start: 11, end: 14 })).toBe("11 AM–2 PM");
  });

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
