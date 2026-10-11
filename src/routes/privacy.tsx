import { Link, createFileRoute } from "@tanstack/react-router";

import { BrandMark } from "@/components/brand-mark";

// Optional: where students can ask for their scout name and reports to be deleted.
const CONTACT_EMAIL: string | undefined = import.meta.env.VITE_CONTACT_EMAIL;

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
          Browsing needs nothing. When you send your first sighting, your browser gets an anonymous
          ID and you pick a public scout name. Please don't use your real name.
        </p>

        <h2>What a sighting contains</h2>
        <p>
          A lot, a time and your scout name. Nothing else: no location, photos, notes, or anything
          about parking officers.
        </p>

        <h2>Who can see it</h2>
        <p>
          Everyone sees sightings from the last 24 hours. After that, only you can see your own, and
          they just count towards the weekly leaderboard, which shows scout names and points.
        </p>

        <h2>Where it lives</h2>
        <p>
          Sightings and scout names are stored with Supabase, and the site is hosted on Vercel; both
          keep standard server logs, such as IP addresses. Map tiles load straight from
          OpenStreetMap and Esri (or MapTiler as a backup), and your first report runs a Cloudflare
          Turnstile bot check, so those services see your IP address too. There are no ads,
          analytics or tracking cookies.
        </p>
        <p>
          Your browser keeps your anonymous sign-in, chosen lot and map style in local storage.
          Clearing this site's data forgets them, and you'll get a fresh ID next time.
        </p>

        {CONTACT_EMAIL && (
          <>
            <h2>Deleting your data</h2>
            <p>
              To have your scout name and sightings removed, email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with your scout name.
            </p>
          </>
        )}

        <p className="prose-back">
          <Link to="/" search={{}}>
            ← Back to the radar
          </Link>
        </p>
      </main>
    </div>
  );
}
