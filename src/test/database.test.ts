// @vitest-environment node
// Runs every Supabase migration against an in-process Postgres (PGlite) with a
// minimal stand-in for Supabase's auth schema, then checks the security rules.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const MIGRATIONS = path.resolve(__dirname, "../../supabase/migrations");

const SUPABASE_STUB = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create role anon;
  create role authenticated;
  grant usage on schema public, auth to anon, authenticated;
  create publication supabase_realtime;
`;

const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";

let db: PGlite;

async function as(role: "anon" | "authenticated" | "postgres", userId?: string) {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub', '${userId ?? ""}', false);`,
  );
  if (role !== "postgres") await db.exec(`set role ${role};`);
}

async function addScout(id: string, username: string) {
  await as("postgres");
  await db.query("insert into auth.users (id) values ($1)", [id]);
  await as("authenticated", id);
  await db.query("insert into public.profiles (id, username) values ($1, $2)", [id, username]);
}

async function report(lot: string) {
  return db.query<{ id: string }>("insert into public.reports (lot_id) values ($1) returning id", [
    lot,
  ]);
}

/** Insert a report in the past, skipping the trigger that stamps now(). */
async function backdate(userId: string, lot: string, minutesAgo: number) {
  await as("postgres");
  await db.exec("set session_replication_role = replica;");
  await db.query(
    "insert into public.reports (lot_id, reporter_id, created_at) values ($1, $2, now() - make_interval(mins => $3))",
    [lot, userId, minutesAgo],
  );
  await db.exec("set session_replication_role = origin;");
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of readdirSync(MIGRATIONS).sort()) {
    await db.exec(readFileSync(path.join(MIGRATIONS, file), "utf8"));
  }
}, 60_000);

beforeEach(async () => {
  await as("postgres");
  await db.exec("truncate public.reports, public.profiles, auth.users cascade;");
  await addScout(ALICE, "alice_scout");
  await addScout(BOB, "bob");
});

describe("reports migration", () => {
  it("lets a scout report and everyone read, with server-side timestamps", async () => {
    await as("authenticated", ALICE);
    await report("P9");

    await as("anon");
    const { rows } = await db.query<{ lot_id: string; reporter_id: string; fresh: boolean }>(
      "select lot_id, reporter_id, created_at > now() - interval '1 minute' as fresh from public.reports",
    );
    expect(rows).toEqual([{ lot_id: "P9", reporter_id: ALICE, fresh: true }]);
  });

  it("blocks anonymous visitors and impersonation", async () => {
    await as("anon");
    await expect(report("P9")).rejects.toThrow(/permission denied/);

    // The client may only send the lot: reporter and timestamp are the server's.
    await as("authenticated", ALICE);
    await expect(
      db.query("insert into public.reports (lot_id, reporter_id) values ('P9', $1)", [BOB]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query(
        "insert into public.reports (lot_id, created_at) values ('P9', now() - interval '1 day')",
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("rejects unknown lots and bad scout names", async () => {
    await as("authenticated", ALICE);
    await expect(report("P99")).rejects.toThrow(/reports_lot_id_known/);

    await as("postgres");
    await db.query("insert into auth.users (id) values ($1)", [
      "00000000-0000-4000-8000-00000000000c",
    ]);
    await as("authenticated", "00000000-0000-4000-8000-00000000000c");
    await expect(
      db.query("insert into public.profiles (id, username) values ($1, 'no spaces!')", [
        "00000000-0000-4000-8000-00000000000c",
      ]),
    ).rejects.toThrow(/profiles_username_format/);
    await expect(
      db.query("insert into public.profiles (id, username) values ($1, 'ALICE_SCOUT')", [
        "00000000-0000-4000-8000-00000000000c",
      ]),
    ).rejects.toThrow(/profiles_username_unique/);
  });

  it("allows one report per scout per lot every 5 minutes", async () => {
    await as("authenticated", ALICE);
    await report("P4");
    await expect(report("P4")).rejects.toThrow(/cooldown/);
    await expect(report("P8")).resolves.toBeTruthy();

    // Another scout can still report the same lot.
    await as("authenticated", BOB);
    await expect(report("P4")).resolves.toBeTruthy();

    await backdate(BOB, "IC", 6);
    await as("authenticated", BOB);
    await expect(report("IC")).resolves.toBeTruthy();
  });

  it("caps each scout at 6 reports an hour", async () => {
    for (const [lot, minutes] of [
      ["P9", 50],
      ["P4", 40],
      ["P8", 30],
      ["P11", 20],
      ["CCT", 18],
      ["IC", 16],
    ] as const) {
      await backdate(ALICE, lot, minutes);
    }
    await as("authenticated", ALICE);
    await expect(report("P9")).rejects.toThrow(/rate_limit/);
  });

  it("never lets the client update or delete reports", async () => {
    await as("authenticated", ALICE);
    const { rows } = await report("P9");
    const id = rows[0]!.id;

    await expect(db.query("delete from public.reports where id = $1", [id])).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      db.query("update public.reports set lot_id = 'P4' where id = $1", [id]),
    ).rejects.toThrow(/permission denied/);

    await as("anon");
    const { rows: left } = await db.query<{ lot_id: string }>("select lot_id from public.reports");
    expect(left).toEqual([{ lot_id: "P9" }]);
  });

  it("keeps a report, without its reporter, when the scout's profile is deleted", async () => {
    await backdate(ALICE, "P9", 1);
    await as("postgres");
    await db.query("delete from public.profiles where id = $1", [ALICE]);
    const { rows } = await db.query<{ reporter_id: string | null }>(
      "select reporter_id from public.reports",
    );
    expect(rows).toEqual([{ reporter_id: null }]);
  });

  it("scores the weekly leaderboard at 25 points per report", async () => {
    await backdate(ALICE, "P9", 0);
    await backdate(ALICE, "P4", 0);
    await backdate(BOB, "P8", 0);

    await as("anon");
    const { rows } = await db.query<{ username: string; points: number }>(
      "select username, points from public.weekly_leaderboard()",
    );
    expect(rows).toEqual([
      { username: "alice_scout", points: 50 },
      { username: "bob", points: 25 },
    ]);
  });

  it("hides reports older than 24 hours, except your own, but still scores them", async () => {
    await backdate(ALICE, "P9", 26 * 60);
    await backdate(BOB, "P4", 10);

    await as("anon");
    const { rows: visible } = await db.query<{ lot_id: string }>(
      "select lot_id from public.reports",
    );
    expect(visible).toEqual([{ lot_id: "P4" }]);

    await as("authenticated", ALICE);
    const { rows: own } = await db.query<{ lot_id: string }>(
      "select lot_id from public.reports order by lot_id",
    );
    expect(own).toEqual([{ lot_id: "P4" }, { lot_id: "P9" }]);

    // The leaderboard still counts it whenever it falls in this Toronto week.
    const { rows: week } = await db.query<{ in_week: boolean }>(
      `select now() - interval '26 hours' >= date_trunc('week', now() at time zone 'America/Toronto') at time zone 'America/Toronto' as in_week`,
    );
    await as("anon");
    const { rows: board } = await db.query<{ username: string }>(
      "select username from public.weekly_leaderboard() where username = 'alice_scout'",
    );
    expect(board).toHaveLength(week[0]!.in_week ? 1 : 0);
  });

  it("rejects scout names that impersonate staff or the app", async () => {
    const carol = "00000000-0000-4000-8000-00000000000c";
    await as("postgres");
    await db.query("insert into auth.users (id) values ($1)", [carol]);
    await as("authenticated", carol);
    for (const name of [
      "You",
      "admin",
      "UTM",
      "LotPulse_team",
      "utm_parking_services",
      "CampusPolice",
    ]) {
      await expect(
        db.query("insert into public.profiles (id, username) values ($1, $2)", [carol, name]),
      ).rejects.toThrow(/profiles_username_reserved/);
    }
    await expect(
      db.query("insert into public.profiles (id, username) values ($1, 'utm_commuter')", [carol]),
    ).resolves.toBeTruthy();
  });
});
