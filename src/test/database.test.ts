// @vitest-environment node
// Runs every Supabase migration against an in-process Postgres (PGlite) with a
// minimal stand-in for Supabase's auth schema, then checks the security rules.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildSetupSql, SETUP_SQL } from "../../scripts/setup-sql";

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
  -- Like Supabase: new tables and functions in public start fully granted to
  -- the API roles, so the migrations must take away what they don't need.
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
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

  it("never lets the client change or remove scout names", async () => {
    for (const [role, user] of [
      ["anon", undefined],
      ["authenticated", ALICE],
    ] as const) {
      await as(role, user);
      for (const sql of [
        "update public.profiles set username = 'renamed' where id = $1",
        "delete from public.profiles where id = $1",
      ]) {
        await expect(db.query(sql, [ALICE])).rejects.toThrow(/permission denied/);
      }
      await expect(db.exec("truncate public.profiles cascade")).rejects.toThrow(
        /permission denied/,
      );
    }

    // A new scout sends only their id and name; the join time is the server's.
    const carol = "00000000-0000-4000-8000-00000000000c";
    await as("postgres");
    await db.query("insert into auth.users (id) values ($1)", [carol]);
    await as("authenticated", carol);
    await expect(
      db.query(
        "insert into public.profiles (id, username, created_at) values ($1, 'carol', now() - interval '1 year')",
        [carol],
      ),
    ).rejects.toThrow(/permission denied/);

    await as("anon");
    const { rows } = await db.query<{ username: string }>(
      "select username from public.profiles order by username",
    );
    expect(rows).toEqual([{ username: "alice_scout" }, { username: "bob" }]);
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

  it("lets a scout delete their own data, and only theirs", async () => {
    await backdate(ALICE, "P9", 1);
    await backdate(ALICE, "P4", 26 * 60);
    await backdate(BOB, "P8", 1);

    await as("anon");
    await expect(db.query("select public.delete_my_data()")).rejects.toThrow(/permission denied/);

    await as("authenticated", ALICE);
    await db.query("select public.delete_my_data()");

    await as("postgres");
    const { rows: reports } = await db.query<{ reporter_id: string }>(
      "select reporter_id from public.reports",
    );
    expect(reports).toEqual([{ reporter_id: BOB }]);
    const { rows: profiles } = await db.query<{ username: string }>(
      "select username from public.profiles",
    );
    expect(profiles).toEqual([{ username: "bob" }]);
    const { rows: users } = await db.query<{ id: string }>("select id from auth.users");
    expect(users).toEqual([{ id: BOB }]);
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

  it("rejects offensive scout names, even disguised, but not words that contain them", async () => {
    // The blocked examples are ROT13-encoded, like the word lists in the migration.
    const rot13 = (text: string) =>
      text.replace(/[a-z]/gi, (c) => {
        const base = c <= "Z" ? 65 : 97;
        return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
      });
    const blocked = [
      "qrpx_shpxre", // anywhere in the name
      "Fu1gCbfgre", // leetspeak and camelCase
      "shhhhpx_hgz", // stretched letters
      "OvtPbpx", // a whole-word term between camelCase words
      "n_f_f", // spelled out with underscores
      "nffff_zna",
      "e4cvfg",
      "a4mv_fpbhg",
      "xxxx",
      "obl1488",
      "n55u0yr",
      "Ergneqrq_Qevire",
      "qvpx",
      "GVG5",
    ].map(rot13);
    const allowed = [
      "class_act",
      "grape_drape",
      "the_therapist",
      "peacock_fan",
      "raccoon",
      "spicy_deck",
      "homework_hero",
      "analysis_guy",
      "torpedo",
      "montenegro",
      "as_you_were",
      "cocktail",
      "bass_player",
      "assassin",
      "Nazir",
      "titan",
      "skyscraper",
      "Dickens",
      "scoutwatch",
      "wristwatch",
      "saltwater",
      "swanky",
      "flame_retardant",
      "rapped",
      "Shiite",
      "poor_nerd",
      "deck_runner",
      "nightowl_22",
    ];

    await as("anon");
    for (const name of blocked) {
      const { rows } = await db.query<{ bad: boolean }>(
        "select public.username_is_offensive($1) as bad",
        [name],
      );
      expect({ name, bad: rows[0]!.bad }).toEqual({ name, bad: true });
    }
    for (const name of allowed) {
      const { rows } = await db.query<{ bad: boolean }>(
        "select public.username_is_offensive($1) as bad",
        [name],
      );
      expect({ name, bad: rows[0]!.bad }).toEqual({ name, bad: false });
    }

    // The table enforces it on new scouts.
    const carol = "00000000-0000-4000-8000-00000000000c";
    await as("postgres");
    await db.query("insert into auth.users (id) values ($1)", [carol]);
    await as("authenticated", carol);
    await expect(
      db.query("insert into public.profiles (id, username) values ($1, $2)", [carol, blocked[0]]),
    ).rejects.toThrow(/profiles_username_clean/);
    await expect(
      db.query("insert into public.profiles (id, username) values ($1, 'peacock_fan')", [carol]),
    ).resolves.toBeTruthy();
  });

  it("never rejects or changes existing names when the name filter is added", async () => {
    // NOT VALID: the constraint skips rows that were there before it.
    await as("postgres");
    const { rows } = await db.query<{ convalidated: boolean }>(
      "select convalidated from pg_constraint where conname = 'profiles_username_clean'",
    );
    expect(rows).toEqual([{ convalidated: false }]);
  });
});

// A snapshot of everything the migrations define, to compare databases.
const SCHEMA_SNAPSHOT = `
  select 'column ' || table_name || '.' || column_name || ' ' || data_type || ' ' || is_nullable
    from information_schema.columns where table_schema = 'public'
  union all
  select 'policy ' || tablename || ' ' || policyname || ' ' || cmd || ' ' || coalesce(qual, '')
    || ' ' || coalesce(with_check, '') from pg_policies where schemaname = 'public'
  union all
  select 'constraint ' || conrelid::regclass || ' ' || conname || ' ' || pg_get_constraintdef(oid)
    from pg_constraint where connamespace = 'public'::regnamespace
  union all
  select 'index ' || indexname || ' ' || indexdef from pg_indexes where schemaname = 'public'
  union all
  select 'trigger ' || tgrelid::regclass || ' ' || tgname from pg_trigger
    where not tgisinternal and tgrelid::regclass::text like 'public.%'
  union all
  select 'function ' || p.oid::regprocedure || ' ' || md5(p.prosrc) from pg_proc p
    where p.pronamespace = 'public'::regnamespace
  union all
  select 'grant ' || table_name || ' ' || grantee || ' ' || privilege_type
    from information_schema.role_table_grants
    where table_schema = 'public' and grantee in ('anon', 'authenticated')
  union all
  select 'realtime ' || schemaname || '.' || tablename from pg_publication_tables
    where pubname = 'supabase_realtime'
  order by 1
`;

async function freshDatabase() {
  const fresh = new PGlite();
  await fresh.exec(SUPABASE_STUB);
  return fresh;
}

async function snapshot(target: PGlite) {
  const { rows } = await target.query<Record<string, string>>(SCHEMA_SNAPSHOT);
  return rows.map((row) => Object.values(row)[0]);
}

async function applied(target: PGlite) {
  const { rows } = await target.query<{ version: string }>(
    "select version from supabase_migrations.schema_migrations order by version",
  );
  return rows.map((row) => row.version);
}

describe("supabase/setup.sql", () => {
  const versions = readdirSync(MIGRATIONS)
    .sort()
    .map((file) => file.split("_")[0]);

  it("is up to date with the migrations", () => {
    expect(readFileSync(SETUP_SQL, "utf8")).toBe(buildSetupSql());
  });

  it("builds the same database as the migrations, and is safe to run again", async () => {
    const setup = readFileSync(SETUP_SQL, "utf8");
    const fresh = await freshDatabase();
    await fresh.exec(setup);
    expect(await applied(fresh)).toEqual(versions);
    const once = await snapshot(fresh);
    expect(once.length).toBeGreaterThan(30);

    await fresh.exec(setup);
    expect(await snapshot(fresh)).toEqual(once);
    expect(await applied(fresh)).toEqual(versions);

    await as("postgres");
    expect(once).toEqual(await snapshot(db));
    expect(once).toContain("realtime public.reports");
  }, 60_000);

  // Every migration pasted into the SQL Editor by hand, without being recorded:
  // setup.sql must recognise what's there and finish the rest. A new migration
  // that can't safely run twice needs a check in the baseline of setup-sql.ts.
  const files = readdirSync(MIGRATIONS).sort();
  it.each(files.map((file, index) => [index + 1, file] as const))(
    "finishes a database where the first %i migration(s), up to %s, were applied by hand",
    async (count) => {
      const partial = await freshDatabase();
      for (const file of files.slice(0, count)) {
        await partial.exec(readFileSync(path.join(MIGRATIONS, file), "utf8"));
      }

      await partial.exec(readFileSync(SETUP_SQL, "utf8"));
      expect(await applied(partial)).toEqual(versions);
      await as("postgres");
      expect(await snapshot(partial)).toEqual(await snapshot(db));
    },
    60_000,
  );

  it("skips a migration that was applied by hand after setup.sql last ran", async () => {
    // What happened in production: setup.sql ran once, then delete_my_data was
    // pasted in on its own, so the history doesn't list it.
    const partial = await freshDatabase();
    const earlier = files.filter((file) => file < "20261012");
    for (const file of earlier) {
      await partial.exec(readFileSync(path.join(MIGRATIONS, file), "utf8"));
    }
    await partial.exec(`
      create schema supabase_migrations;
      create table supabase_migrations.schema_migrations (
        version text primary key, statements text[], name text
      );
      insert into supabase_migrations.schema_migrations (version)
      values ${earlier.map((file) => `('${file.split("_")[0]}')`).join(", ")};
    `);
    await partial.exec(
      readFileSync(path.join(MIGRATIONS, "20261012000000_delete_my_data.sql"), "utf8"),
    );

    await partial.exec(readFileSync(SETUP_SQL, "utf8"));
    expect(await applied(partial)).toEqual(versions);
    await as("postgres");
    expect(await snapshot(partial)).toEqual(await snapshot(db));
  }, 60_000);
});
