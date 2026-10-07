# LotPulse

A predictive parking radar for students at the **University of Toronto Mississauga (UTM)**.

LotPulse shows, for every campus lot:

- **Live status**: whether a scout has recently spotted parking enforcement.
- **Threat level**: a predicted probability of a patrol right now.
- **Hour-by-hour forecast**: when patrols are most likely today, with a countdown to the next peak.
- **One-tap reporting**: spot an enforcer, warn campus, earn clout.
- **Clout System**: a weekly scout leaderboard, streaks and badges.

> **Demo data.** Every threat level, forecast, report, payment and leaderboard entry is simulated
> in the browser. LotPulse isn't affiliated with UTM, and it doesn't take payments or send real alerts.
> For real parking, use UTM's official parking services.

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

No environment variables or API keys are needed. The campus map uses
[Leaflet](https://leafletjs.com) with free OpenStreetMap tiles and Esri satellite imagery.

## Deploying to Vercel

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
  components/ui/   Low-level primitives (button, dialog, sheet, toaster)
  lib/lots.ts      Single source of truth for lots, positions and simulated forecasts
  lib/store.ts     Client-side app state, persisted to localStorage
  styles.css       Design tokens and component styles
```

## Tech

TanStack Start · React 19 · Vite · Tailwind CSS 4 · Leaflet · Radix UI · Vitest
