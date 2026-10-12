import type { Tone } from "@/lib/lots";

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** The ring is full at this many reports, where risk becomes high. */
const FULL_AT = 2;

/** `count` is null while reports are loading or unreachable. */
export function ThreatGauge({ count, tone }: { count: number | null; tone: Tone | "unknown" }) {
  const filled =
    ((count === null ? 0 : Math.min(FULL_AT, Math.max(0, count))) / FULL_AT) * CIRCUMFERENCE;
  return (
    <div
      className="gauge"
      data-tone={tone}
      role="img"
      aria-label={
        count === null
          ? "Reports unknown"
          : `${count} ${count === 1 ? "report" : "reports"} in the last 2 hours`
      }
    >
      <svg viewBox="0 0 100 100" aria-hidden>
        <circle className="gauge-track" cx="50" cy="50" r={RADIUS} />
        <circle
          className="gauge-value"
          cx="50"
          cy="50"
          r={RADIUS}
          strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
        />
      </svg>
      <span className="gauge-label" aria-hidden>
        {count ?? "–"}
      </span>
    </div>
  );
}
