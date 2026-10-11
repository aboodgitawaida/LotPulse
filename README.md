# LotPulse

Live parking enforcement reports for students at the **University of Toronto Mississauga (UTM)**.

LotPulse shows, for every campus lot:

- **Last sighting**: when a student last reported enforcement there, and who (by scout name).
- **Risk level**: how many reports the lot got in the last 2 hours.
- **One-tap reporting**: spot an enforcer, warn campus, earn clout.
- **Clout system**: a weekly scout leaderboard and badges.

Everything shown comes from real student reports. Reports are crowd-sourced and unverified.
LotPulse isn't affiliated with UTM. For real parking, use UTM's official services.

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

Without the Supabase environment variables the app runs but is **not connected**: it shows no
reports and won't send any. The campus map uses [Leaflet](https://leafletjs.com) with the public OpenStreetMap tiles
(darkened with CSS) and Esri satellite imagery, which need no key. Those servers aren't meant for
app traffic and may throttle or block a busy site, so set `VITE_MAPTILER_KEY`
([MapTiler](https://www.maptiler.com), free for 100k map loads a month) as a backup: when the
public tiles fail, the map switches to MapTiler for that visit, with the same darkened look. The
key is public by design: in MapTiler, restrict it to your domains.

## How live reports work

1. **Reporting.** "Spotted enforcement at P9" inserts a row into the Supabase `reports` table
   (`id`, `lot_id`, `created_at`, `reporter_id`). The first time, the browser signs in with
   **Supabase anonymous auth** (no email or password) and the student picks a public scout name.
   On success the dialog closes and a confirmation appears; on failure the dialog stays open and
   says why (no connection, 5-minute cooldown, name taken…).
2. **Live updates.** Every open page subscribes to **Supabase Realtime** inserts on `reports`.
   A new report lands on every device within a second or two, with no refresh, updating the map
   pins, lot cards, "Last sighting" and the feed. Phones that were asleep or lost their connection
   refetch on wake and on reconnect.
3. **What the numbers mean.**
   - _Last sighting X min ago_: the newest report for that lot (from the last 24 hours), or
     "No recent reports".
   - _Risk_: reports for that lot in the last **2 hours**. **0 = clear** (green), **1 = caution**
     (amber), **2 or more = high risk** (red). That's the whole rule (`riskFor` in
     `src/lib/lots.ts`).
   - _Clout_: **+25 per report**, counted by the database from your reports since Monday
     (`weekly_leaderboard()`), so nobody can edit their own points.
4. **Rules the database enforces** (`supabase/migrations/`, tested in
   `src/test/database.test.ts`):
   - Anyone can read reports from the last 24 hours (older ones only by their reporter).
   - A signed-in user can only insert their own report: the client sends just the `lot_id`, and the
     `guard_report` trigger sets `reporter_id` to the caller and `created_at` to server time.
   - No updates or deletes from the client.
   - One report per user per lot every **5 minutes**, and at most 6 an hour.

### Setting it up

1. **Database.** Apply the migrations in `supabase/migrations/` in order. If the Supabase GitHub
   integration is connected with "Deploy to production" on, merging to `main` does it. Otherwise
   paste all of `supabase/setup.sql` into the Supabase **SQL Editor** and press **Run**: it applies
   every migration you haven't run yet, oldest first, in one transaction, and is safe to run again.
   It's generated from the migrations (`bun run db:setup-sql` after adding one).
2. **Anonymous sign-in.** In Supabase, open **Authentication → Sign In / Providers** and turn on
   **Allow anonymous sign-ins**.
3. **Realtime.** The migrations add `reports` to the `supabase_realtime` publication. To check,
   open **Database → Publications → supabase_realtime** and make sure `reports` is ticked.
4. **Keys.** In Vercel (**Project → Settings → Environment Variables**) add, for Production and
   Preview:
   - `VITE_SUPABASE_URL`: your project URL, e.g. `https://abcd1234.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: the publishable (`sb_publishable_…`) or legacy anon key

   Then **redeploy**: Vite bakes these into the build, so existing deployments won't pick them up.
   For local development copy `.env.example` to `.env`.

5. **Check it.** `bun run verify:live` signs in anonymously with the publishable key, reports P9,
   reads it back, waits for the Realtime event on a second client, checks the live site was built
   with the keys, then deletes the test data (set `SUPABASE_SECRET_KEY` in your shell for the
   cleanup; otherwise it prints the SQL to remove it). It needs the same two variables as the app.

6. **Optional.** `VITE_SITE_URL` sets the absolute URL used in link previews (it defaults to
   Vercel's production domain), and `VITE_CONTACT_EMAIL` adds a data-deletion contact to
   `/privacy`.
7. **Bot check (Cloudflare Turnstile).** Anonymous accounts are free to create, so without a
   captcha one script can make thousands and flood the map. In Cloudflare, add a Turnstile widget
   (Managed mode) for your production hostname, then:
   - set `VITE_TURNSTILE_SITE_KEY` in Vercel to its **site key** and redeploy. The report dialog
     then shows the check before a scout's first report;
   - only once that deploy is live, open Supabase **Authentication → Attack Protection**, enable
     Captcha protection with Turnstile, paste the **secret key** and save. Saving first would make
     every first report fail, because the old site sends no captcha token.

   With captcha on, `bun run verify:live` can't sign in (it has no token). Turn captcha off while
   running it, or skip it.

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
  components/      Dashboard UI (focus lot, map, feed, leaderboard, dialogs…)
  components/ui/   Low-level primitives (button, dialog, toaster)
  lib/lots.ts      Single source of truth for lots, positions and the risk rule
  lib/store.tsx    App state: per-lot status from live reports, plus local lot selection
  lib/live.ts      Supabase data: Realtime feed, leaderboard, anonymous sign-in, reporting
  styles.css       Design tokens and component styles
supabase/
  migrations/      Database schema, row level security and guards
  setup.sql        All migrations in one re-runnable script for the SQL Editor (generated)
scripts/           setup.sql generator and the live end-to-end check
```

## Tech

TanStack Start · React 19 · Vite · Tailwind CSS 4 · Supabase · Leaflet · Radix UI · Vitest
