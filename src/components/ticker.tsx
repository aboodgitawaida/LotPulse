import { Fragment } from "react";

/**
 * Full-bleed scrolling marquee. Purely decorative: everything it shows is also
 * on the page in accessible form, so it's hidden from assistive tech.
 */
export function Ticker({ items }: { items: readonly { label: string; tone?: string }[] }) {
  const run = (copy: number) => (
    <div className="ticker-run" key={copy}>
      {items.map((item) => (
        <Fragment key={item.label}>
          <span className="ticker-item" data-tone={item.tone}>
            {item.label}
          </span>
          <span className="ticker-sep">✦</span>
        </Fragment>
      ))}
    </div>
  );
  return (
    <div className="ticker" aria-hidden>
      <div className="ticker-track">{[0, 1].map(run)}</div>
    </div>
  );
}
