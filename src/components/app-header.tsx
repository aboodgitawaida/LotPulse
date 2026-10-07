import { Link } from "@tanstack/react-router";
import { Map as MapIcon, Radar, Trophy, Zap } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";

export type View = "radar" | "clout";

export function AppHeader({ view, points }: { view: View; points: number }) {
  return (
    <header className="topbar">
      <Link to="/" search={{}} className="brand" aria-label="LotPulse home">
        <BrandMark className="brand-mark" />
        <span className="brand-word">
          Lot<span>Pulse</span>
        </span>
        <span className="brand-tag">UTM</span>
      </Link>
      <nav className="topnav" aria-label="Main">
        <Link
          to="/"
          search={{}}
          className="topnav-link"
          aria-current={view === "radar" ? "page" : undefined}
        >
          <Radar aria-hidden /> Radar
        </Link>
        <Link
          to="/"
          search={{ view: "clout" }}
          className="topnav-link"
          aria-current={view === "clout" ? "page" : undefined}
        >
          <Trophy aria-hidden /> Clout
        </Link>
      </nav>
      <Link
        to="/"
        search={{ view: "clout" }}
        className="points-pill"
        aria-label={`${points} clout points`}
      >
        <Zap aria-hidden /> {points}
        <span> pts</span>
      </Link>
    </header>
  );
}

export function MobileNav({ view, onOpenMap }: { view: View; onOpenMap: () => void }) {
  return (
    <nav className="mobile-nav" aria-label="Main">
      <Link
        to="/"
        search={{}}
        className="mobile-nav-link"
        aria-current={view === "radar" ? "page" : undefined}
      >
        <Radar aria-hidden /> Radar
      </Link>
      <button type="button" className="mobile-nav-link" onClick={onOpenMap}>
        <MapIcon aria-hidden /> Map
      </button>
      <Link
        to="/"
        search={{ view: "clout" }}
        className="mobile-nav-link"
        aria-current={view === "clout" ? "page" : undefined}
      >
        <Trophy aria-hidden /> Clout
      </Link>
    </nav>
  );
}
