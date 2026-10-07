import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { TrendingUp } from "lucide-react";

import { formatHour, formatWindow } from "@/lib/format";
import { dailyForecast, peakWindow, toneFor, type Lot } from "@/lib/lots";

const FIRST_HOUR = 6;
const LAST_HOUR = 23;
const HEIGHT = 168;
const PAD = { top: 16, right: 12, bottom: 28, left: 34 };
const TICKS = [6, 9, 12, 15, 18, 21];

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export function ThreatForecast({ lot, now }: { lot: Lot; now: Date }) {
  const gradientId = useId();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const forecast = dailyForecast(lot, now);
  const window = peakWindow(forecast);
  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);

  const plotWidth = Math.max(0, width - PAD.left - PAD.right);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (hour: number) =>
    PAD.left + ((hour - FIRST_HOUR) / (LAST_HOUR - FIRST_HOUR)) * plotWidth;
  const y = (value: number) => PAD.top + (1 - value / 100) * plotHeight;
  const baseline = PAD.top + plotHeight;

  const points = hours.map((hour) => [x(hour), y(forecast[hour] ?? 0)] as const);
  const line = points
    .map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`)
    .join("");
  const area = `${line}L${x(LAST_HOUR).toFixed(1)},${baseline}L${x(FIRST_HOUR).toFixed(1)},${baseline}Z`;

  const nowHour = now.getHours() + now.getMinutes() / 60;
  const showNow = nowHour >= FIRST_HOUR && nowHour <= LAST_HOUR;
  const valueAt = (hour: number) => {
    const floor = Math.floor(hour);
    const a = forecast[floor] ?? 0;
    const b = forecast[Math.min(23, floor + 1)] ?? a;
    return a + (b - a) * (hour - floor);
  };

  const onPointer = (event: PointerEvent<SVGSVGElement>) => {
    if (plotWidth <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left - PAD.left) / plotWidth;
    const hour = Math.round(FIRST_HOUR + ratio * (LAST_HOUR - FIRST_HOUR));
    setHover(Math.min(LAST_HOUR, Math.max(FIRST_HOUR, hour)));
  };

  const hoverValue = hover === null ? null : (forecast[hover] ?? 0);

  return (
    <section className="card forecast" aria-labelledby={`${gradientId}-title`}>
      <header className="card-header">
        <h2 id={`${gradientId}-title`} className="eyebrow">
          <TrendingUp aria-hidden /> Today's patrol forecast · {lot.short}
        </h2>
        <span className="forecast-peak">
          {window ? (
            <>
              Peak <strong>{formatWindow(window)}</strong>
            </>
          ) : (
            "No peak today"
          )}
        </span>
      </header>

      <div ref={ref} className="forecast-plot">
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            className="forecast-chart"
            aria-hidden
            onPointerMove={onPointer}
            onPointerDown={onPointer}
            onPointerLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient
                id={`${gradientId}-line`}
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1={baseline}
                x2="0"
                y2={PAD.top}
              >
                {/* Offsets track the threat thresholds: 40% medium, 70% high. */}
                <stop offset="0%" stopColor="var(--tone-low)" />
                <stop offset="36%" stopColor="var(--tone-low)" />
                <stop offset="44%" stopColor="var(--tone-medium)" />
                <stop offset="66%" stopColor="var(--tone-medium)" />
                <stop offset="74%" stopColor="var(--tone-high)" />
                <stop offset="100%" stopColor="var(--tone-high)" />
              </linearGradient>
              <linearGradient id={`${gradientId}-fill`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.24" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {[0, 40, 70, 100].map((value) => (
              <g key={value}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(value)}
                  y2={y(value)}
                  className="forecast-grid"
                />
                <text
                  x={PAD.left - 8}
                  y={y(value)}
                  className="forecast-axis"
                  textAnchor="end"
                  dominantBaseline="middle"
                >
                  {value}%
                </text>
              </g>
            ))}

            {window && (
              <rect
                x={x(Math.max(FIRST_HOUR, window.start))}
                y={PAD.top}
                width={Math.max(
                  0,
                  x(Math.min(LAST_HOUR, window.end)) - x(Math.max(FIRST_HOUR, window.start)),
                )}
                height={plotHeight}
                className="forecast-peak-band"
              />
            )}

            <path d={area} fill={`url(#${gradientId}-fill)`} />
            <path d={line} stroke={`url(#${gradientId}-line)`} className="forecast-line" />

            {showNow && (
              <g className="forecast-now">
                <line x1={x(nowHour)} x2={x(nowHour)} y1={PAD.top} y2={baseline} />
                <circle cx={x(nowHour)} cy={y(valueAt(nowHour))} r={4.5} />
                <text x={x(nowHour)} y={PAD.top - 5} textAnchor="middle">
                  Now
                </text>
              </g>
            )}

            {hover !== null && hoverValue !== null && (
              <g className="forecast-hover">
                <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={baseline} />
                <circle cx={x(hover)} cy={y(hoverValue)} r={5} data-tone={toneFor(hoverValue)} />
              </g>
            )}

            {TICKS.map((hour) => (
              <text
                key={hour}
                x={x(hour)}
                y={HEIGHT - 8}
                className="forecast-axis"
                textAnchor="middle"
              >
                {formatHour(hour)}
              </text>
            ))}
          </svg>
        )}
        {hover !== null && hoverValue !== null && (
          <div
            className="forecast-tooltip"
            data-tone={toneFor(hoverValue)}
            style={{ left: Math.min(Math.max(x(hover), 56), width - 56) }}
          >
            <span>{formatHour(hover)}</span>
            <strong>{hoverValue}%</strong>
          </div>
        )}
      </div>

      <div className="sr-only">
        <table>
          <caption>
            Hourly patrol probability for {lot.name} today
            {window ? `, peaking at ${window.peak}% between ${formatWindow(window)}` : ""}
          </caption>
          <tbody>
            {hours.map((hour) => (
              <tr key={hour}>
                <th scope="row">{formatHour(hour)}</th>
                <td>{forecast[hour]}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="forecast-legend">
        <span>
          <i className="legend-swatch legend-peak" /> Peak window
        </span>
        <span>
          <i className="legend-swatch legend-now" /> Now
        </span>
        <span className="forecast-note">Simulated forecast</span>
      </footer>
    </section>
  );
}
