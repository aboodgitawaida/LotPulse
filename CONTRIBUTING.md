# Contributing to LotPulse

Thanks for helping. LotPulse is small, so the rules are short.

## Setup

```sh
bun install
cp .env.example .env   # optional: add Supabase keys to see live reports
bun run dev            # http://localhost:3000
```

Without Supabase keys the app runs in a "not connected" state: no reports are shown and none can be
sent. See the README for setting up a Supabase project.

## Before you open a pull request

```sh
bun run check   # typecheck, lint (no warnings allowed), format check, tests
bun run build
```

CI runs the same steps on every pull request.

## Commit messages and PR titles

LotPulse uses [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(optional scope): <what changed, in the imperative>
```

| Type       | Use it for                                  |
| ---------- | ------------------------------------------- |
| `feat`     | A new feature students can see or use       |
| `fix`      | A bug fix                                   |
| `perf`     | A speed or bundle-size improvement          |
| `refactor` | A code change that doesn't change behaviour |
| `docs`     | README, comments, other docs                |
| `test`     | Adding or fixing tests                      |
| `build`    | Dependencies, Vite/Nitro config             |
| `ci`       | GitHub Actions                              |
| `chore`    | Anything else (tooling, cleanup)            |

Examples:

```
feat(map): show a pulse on lots reported in the last 10 minutes
fix: keep lots "unknown" while reports can't load
chore(deps): update supabase-js
```

Add `!` after the type (`feat!:`) for a breaking change, such as a migration that needs manual
steps. Pull requests are squash-merged, so the **PR title** becomes the commit on `main`; a check
fails the PR if the title doesn't follow this format.

## Project rules

The rules for data, privacy, migrations and the map are in [AGENTS.md](AGENTS.md). The short
version:

- Everything shown comes from real reports. No simulated data, forecasts or "predictive" wording.
- A report is only a lot, a time and a self-chosen scout name. No photos, free text or anything
  that identifies officers or students.
- Security lives in the database. Database changes go in a new file in `supabase/migrations/`
  with a test in `src/test/database.test.ts`, then run `bun run db:setup-sql`.
