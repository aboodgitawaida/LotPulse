import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

interface HeroProps {
  /** Small label above the headline. */
  eyebrow: string;
  /** Headline lines; the last one is set in the italic accent face. */
  lines: readonly string[];
  subtitle: ReactNode;
  /** Optional block on the right of the headline (stats, chips). */
  aside?: ReactNode;
}

/** Editorial page header: oversized headline that reveals line by line. */
export function Hero({ eyebrow, lines, subtitle, aside }: HeroProps) {
  return (
    <div className="hero">
      <div className="hero-meta">
        <span className="hero-index" aria-hidden>
          (01)
        </span>
        <p className="eyebrow">{eyebrow}</p>
        <LiveClock />
      </div>
      <div className="hero-body">
        <h1 className="hero-title">
          {lines.map((line, index) => (
            <span
              key={line}
              className="hero-line"
              data-accent={index === lines.length - 1}
              style={{ "--i": index } as CSSProperties}
            >
              <span>{line}</span>{" "}
            </span>
          ))}
        </h1>
        {aside && <div className="hero-aside">{aside}</div>}
      </div>
      <p className="hero-subtitle">{subtitle}</p>
    </div>
  );
}

/** Ticking local time, so the page feels like a live instrument. */
function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <time className="hero-clock" dateTime={now.toISOString()} aria-hidden>
      <span className="status-dot" />
      {now.toLocaleTimeString("en-CA", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZoneName: "short",
      })}
    </time>
  );
}
