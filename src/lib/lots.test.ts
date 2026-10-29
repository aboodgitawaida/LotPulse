import { describe, expect, it } from "vitest";

import { campusHour, campusWeekday, formatRate, timeAgo } from "./format";
import { CAMPUS_BOUNDS, CAMPUS_CENTER, LOTS, getLot, riskFor } from "./lots";

const monday = (time: string) => new Date(`2026-10-05T${time}:00`);

describe("lot data", () => {
  it("has a unique id for every lot", () => {
    expect(new Set(LOTS.map((lot) => lot.id)).size).toBe(LOTS.length);
  });
});

describe("campus bounds", () => {
  it("contain every lot and the map's starting point", () => {
    const inside = ({ lat, lng }: { lat: number; lng: number }) =>
      lat > CAMPUS_BOUNDS.south &&
      lat < CAMPUS_BOUNDS.north &&
      lng > CAMPUS_BOUNDS.west &&
      lng < CAMPUS_BOUNDS.east;
    for (const lot of LOTS) expect(inside(lot.position), lot.id).toBe(true);
    expect(inside(CAMPUS_CENTER)).toBe(true);
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

  it("uses campus time, whatever the visitor's time zone", () => {
    // 02:30 UTC on a Friday is still Thursday evening in Mississauga (EDT, UTC-4).
    const instant = new Date("2026-10-30T02:30:00Z");
    expect(campusHour(instant)).toBe(22);
    expect(campusWeekday(instant)).toBe("Thursday");
    // Midnight is hour 0, not 24. In January Toronto is on EST (UTC-5).
    expect(campusHour(new Date("2027-01-15T05:00:00Z"))).toBe(0);
  });
});
