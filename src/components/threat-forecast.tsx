import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { forecastCurves, peakWindows, type LotId } from "@/lib/campus-lots";

const START_HOUR = 6;
const HOURS = 18; // 6:00–23:00

function hourLabel(hour: number) {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${hour < 12 ? "AM" : "PM"}`;
}

export function ThreatForecast({ lot }: { lot: LotId }) {
  const curve = forecastCurves[lot];
  const peak = peakWindows[lot];
  const [nowHour, setNowHour] = useState<number | null>(null);

  useEffect(() => {
    setNowHour(new Date().getHours() + new Date().getMinutes() / 60);
  }, []);

  const width = 340;
  const height = 120;
  const padX = 12;
  const padTop = 14;
  const padBottom = 22;
  const x = (i: number) => padX + (i / (HOURS - 1)) * (width - padX * 2);
  const y = (v: number) => padTop + (1 - v / 100) * (height - padTop - padBottom);
  const hourX = (hour: number) => x(hour - START_HOUR);

  const line = curve
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(HOURS - 1).toFixed(1)} ${height - padBottom} L${padX} ${height - padBottom} Z`;
  const peakValue = Math.max(...curve);
  const showNow = nowHour !== null && nowHour >= START_HOUR && nowHour <= START_HOUR + HOURS - 1;

  return (
    <section className="forecast" aria-label={`Hourly threat forecast for ${lot}`}>
      <div className="forecast-header">
        <div className="metric-label">
          <TrendingUp size={13} /> THREAT FORECAST · {lot === "Inner Circle" ? "IC" : lot}
        </div>
        <span className="forecast-peak">
          Peak window <strong>{peak.label}</strong>
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="forecast-chart"
        role="img"
        aria-label={`Predicted threat peaks at ${peakValue}% during ${peak.label}`}
      >
        <defs>
          <linearGradient id="forecast-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="forecast-fill-top" />
            <stop offset="100%" className="forecast-fill-bottom" />
          </linearGradient>
        </defs>
        {[25, 50, 75].map((v) => (
          <line key={v} x1={padX} x2={width - padX} y1={y(v)} y2={y(v)} className="forecast-grid" />
        ))}
        <rect
          x={hourX(peak.start)}
          y={padTop}
          width={hourX(peak.end) - hourX(peak.start)}
          height={height - padTop - padBottom}
          className="forecast-peak-band"
        />
        <path d={area} className="forecast-area" />
        <path d={line} className="forecast-line" />
        {showNow && (
          <line
            x1={hourX(nowHour)}
            x2={hourX(nowHour)}
            y1={padTop}
            y2={height - padBottom}
            className="forecast-now"
          />
        )}
        {showNow && (
          <circle
            cx={hourX(nowHour)}
            cy={y(curve[Math.min(HOURS - 1, Math.max(0, Math.round(nowHour - START_HOUR)))] ?? 0)}
            r="3.5"
            className="forecast-now-dot"
          />
        )}
        {[6, 10, 14, 18, 22].map((h) => (
          <text key={h} x={hourX(h)} y={height - 8} className="forecast-tick" textAnchor="middle">
            {hourLabel(h)}
          </text>
        ))}
      </svg>
      <div className="forecast-legend">
        <span>
          <i className="legend-swatch legend-peak" /> High patrol probability
        </span>
        {showNow && (
          <span>
            <i className="legend-swatch legend-now" /> Now
          </span>
        )}
        <span className="forecast-note">Simulated prediction</span>
      </div>
    </section>
  );
}
