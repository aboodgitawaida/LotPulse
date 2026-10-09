# LotPulse

A predictive parking radar for students at the **University of Toronto Mississauga (UTM)**.

LotPulse shows, for every campus lot:

- **Live status**: whether a scout has recently spotted parking enforcement.
- **Threat level**: a predicted probability of a patrol right now.
- **Hour-by-hour forecast**: when patrols are most likely today, with a countdown to the next peak.
- **One-tap reporting**: spot an enforcer, warn campus, earn clout.
- **Clout System**: a weekly scout leaderboard, streaks and badges.

> **What's real.** With Supabase configured, sightings, clout and the weekly leaderboard are
> shared live between students. Patrol forecasts are simulated, and the simulated JIT payment
> preview only appears in demo mode, so nobody mistakes it for a real permit. LotPulse isn't
> affiliated with UTM and doesn't take payments. For real parking, use UTM's official services.

## Getting started

Requires **Node 20.19+** and [Bun](https://bun.sh) (npm also works).

```sh
bun install
bun run dev        # http://localhost:3000
```

| Script           | What it does                         |
| ---------------- | ------------------------------------ |
| `bun run dev`    | Start the dev server with hot reload |
| `bun run build`  | Production build into `.output/`     |
| `bun run start`  | Serve the production build with Node |
| `bun run check`  | Typecheck, lint and run the tests    |
| `bun run format` | Format everything with Prettier      |

Without any environment variables the app runs in **demo mode** with simulated sightings. The
campus map uses [Leaflet](https://leafletjs.com) with free OpenStreetMap tiles and Esri satellite
imagery, so it never needs a key.

## Live sightings (Supabase)

1. **Database.** The schema is in `supabase/migrations/`. If the Supabase GitHub integration is
   connected with "Deploy to production" on, merging to `main` applies it. Otherwise paste the
   migration into the Supabase **SQL Editor** and run it once.
2. **Anonymous sign-in.** In Supabase, open **Authentication → Sign In / Providers** and turn on
   **Allow anonymous sign-ins**. Students pick a public scout name with their first report.
3. **Keys.** In Vercel (**Project → Settings → Environment Variables**) add
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (the anon / publishable key, which is
   safe to expose), then redeploy. For local development copy `.env.example` to `.env`.
4. **Optional.** `VITE_SITE_URL` sets the absolute URL used in link previews (it defaults to
   Vercel's production domain), and `VITE_CONTACT_EMAIL` adds a data-deletion contact to
   `/privacy`.

The database enforces the rules itself: anyone can read sightings, only signed-in scouts can post
as themselves, timestamps are set by the server, each scout can report a lot once per 15 minutes
and 6 times an hour, and a sighting can be undone for 2 minutes. Sightings older than 24 hours are
hidden from everyone but their scout (the weekly leaderboard is a function that only returns
totals), and scout names that pose as staff or the app are rejected. `src/test/database.test.ts` checks
all of this against a real Postgres (PGlite).

## Deploying to Vercel

Security headers (CSP, frame blocking, referrer policy) are set in `vite.config.ts` through Nitro
route rules, so they ship with every deploy.

1. Push this repository to GitHub.
2. In Vercel, choose **Add New → Project** and import the repo.
3. Keep the detected defaults (Bun install, `bun run build`). Nitro detects Vercel
   automatically and outputs a Vercel-ready build, so no `vercel.json` is required.

Every branch gets its own preview URL, and `main` deploys to production.

## Project layout

```
src/
  routes/          File-based routes (__root.tsx is the HTML shell, index.tsx the dashboard)
  components/      Dashboard UI (focus lot, forecast, map, leaderboard, dialogs…)
  components/ui/   Low-level primitives (button, dialog, toaster)
  lib/lots.ts      Single source of truth for lots, positions and simulated forecasts
  lib/store.tsx    App state: live (Supabase) or demo, plus local lot selection and sessions
  lib/live.ts      Supabase data: live feed, leaderboard, sign-in, reporting
  styles.css       Design tokens and component styles
supabase/
  migrations/      Database schema, row level security and guards
```

## Tech

TanStack Start · React 19 · Vite · Tailwind CSS 4 · Supabase · Leaflet · Radix UI · Vitest
