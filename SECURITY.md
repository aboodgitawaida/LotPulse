# Security policy

LotPulse is a student project, but real students use it, so security reports are welcome and
taken seriously.

## Reporting a vulnerability

Please don't open a public issue. Email **lotpulse.utm@gmail.com** with:

- what you found and where (URL, file or database object),
- steps to reproduce it,
- what an attacker could do with it.

You'll get a reply within a few days. Please give a reasonable chance to fix the problem before
you share it publicly, and don't access or change other students' data while testing: a test
account of your own is enough to show most issues.

## What's in scope

- The live site, [lotpulse-utm.vercel.app](https://lotpulse-utm.vercel.app)
- The code in this repository, including the database migrations in `supabase/migrations/`

Out of scope: denial-of-service, spam or volume testing, social engineering, and issues in
Supabase, Vercel, Cloudflare or the map tile providers themselves (report those to them).

## How LotPulse is protected

- **The database enforces every rule.** Row level security, least-privilege grants and the
  `guard_report` trigger decide who can read and write, stamp the reporter and time, and apply
  the cooldown and hourly limit. The browser only sends a lot ID.
- **Only public keys ship to the browser.** The Supabase publishable key, Turnstile site key and
  domain-restricted MapTiler key are public by design. Secrets live in Supabase and Vercel.
- **Bots are slowed down.** A Cloudflare Turnstile check runs before a new scout's first report.
- **Strict headers.** Content Security Policy, HSTS, frame blocking, `nosniff`, a referrer policy,
  a permissions policy and a cross-origin opener policy are set on every response.
- **Dependencies are audited in CI** (`bun audit`), and installs skip package versions published
  less than a day ago.
