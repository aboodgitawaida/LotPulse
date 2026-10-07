import type { PeakWindow } from "./lots";

function hourParts(hour: number) {
  const normalized = ((hour % 24) + 24) % 24;
  return {
    value: normalized % 12 === 0 ? 12 : normalized % 12,
    period: normalized < 12 ? "AM" : "PM",
  };
}

/** 13 → "1 PM", 0 → "12 AM". */
export function formatHour(hour: number): string {
  const { value, period } = hourParts(hour);
  return `${value} ${period}`;
}

/** Peak window as "1–4 PM" or "11 AM–2 PM". */
export function formatWindow({ start, end }: Pick<PeakWindow, "start" | "end">): string {
  const from = hourParts(start);
  const to = hourParts(end);
  return from.period === to.period
    ? `${from.value}–${to.value} ${to.period}`
    : `${from.value} ${from.period}–${to.value} ${to.period}`;
}

/** 135 → "2h 15m", 45 → "45m", 120 → "2h". */
export function formatDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** Relative time for timestamps in the past: "just now", "12 min ago", "3h ago". */
export function timeAgo(timestamp: number, now: number): string {
  const minutes = Math.floor((now - timestamp) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}
