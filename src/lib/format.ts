import type { Lot } from "./lots";

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

function dollars(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

/** Posted rate as "$2.75 / 30 min · $15 daily max". */
export function formatRate({ halfHour, dailyMax }: Lot["rate"]): string {
  const base = `$${halfHour.toFixed(2)} / 30 min`;
  return dailyMax === undefined ? base : `${base} · ${dollars(dailyMax)} daily max`;
}

export function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
