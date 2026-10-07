import type { Tone } from "@/lib/lots";

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ThreatGauge({ value, tone }: { value: number; tone: Tone }) {
  const filled = (Math.min(100, Math.max(0, value)) / 100) * CIRCUMFERENCE;
  return (
    <div
      className="gauge"
      data-tone={tone}
      role="img"
      aria-label={`Patrol probability ${value} percent`}
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
        {value}
        <small>%</small>
      </span>
    </div>
  );
}
