import { Link, createFileRoute } from "@tanstack/react-router";

import { BrandMark } from "@/components/brand-mark";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy · LotPulse" },
      { name: "description", content: "What LotPulse stores, who can see it and for how long." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" search={{}} className="brand" aria-label="LotPulse home">
          <BrandMark className="brand-mark" />
          <span className="brand-word">
            Lot<span>Pulse</span>
          </span>
        </Link>
      </header>
      <main id="main" className="page prose-page">
        <h1>Privacy</h1>
        <p className="prose-lede">
          LotPulse is a student project, not affiliated with the University of Toronto. It collects
          as little as it can.
        </p>

        <h2>No account, no email</h2>
        <p>
          Browsing needs nothing. When you send your first report, your browser gets an anonymous ID
          and you pick a public scout name. Please don't use your real name.
        </p>

        <h2>What a report contains</h2>
        <p>
          A lot, a time and your scout name. Nothing else: no location, photos, notes, or anything
          about parking officers.
        </p>

        <h2>Who can see it</h2>
        <p>
          Everyone sees reports from the last 24 hours. After that, only you can see your own, and
          they just count towards the weekly leaderboard, which shows scout names and points.
        </p>
        <p>
          Reports are public while they're visible, so anyone could save which lots a scout name
          reported and when. That's another reason to pick a name nobody can trace back to you.
        </p>

        <h2>Where it lives</h2>
        <p>
          Reports and scout names are stored with Supabase, and the site is hosted on Vercel; both
          keep standard server logs, such as IP addresses. Map tiles load straight from
          OpenStreetMap and Esri (or MapTiler as a backup), and your first report runs a Cloudflare
          Turnstile bot check, so those services see your IP address too. There are no ads,
          analytics or tracking cookies.
        </p>
        <p>
          Your browser keeps your anonymous sign-in, chosen lot and map style in local storage.
          Clearing this site's data forgets them, and you'll get a fresh ID next time.
        </p>

        <h2>Deleting your data</h2>
        <p>
          Open the{" "}
          <Link to="/" search={{ view: "clout" }}>
            Clout
          </Link>{" "}
          tab and tap <strong>Delete my data</strong>. It permanently deletes your scout name, every
          report you've sent and your anonymous ID, straight away. Only the browser that made the
          scout can delete it, so nobody can delete yours. If you've cleared this site's data, that
          ID is already gone from your browser, and your reports drop out of public view after 24
          hours.
        </p>

        <p className="prose-back">
          <Link to="/" search={{}}>
            ← Back to the radar
          </Link>
        </p>
      </main>
    </div>
  );
}
