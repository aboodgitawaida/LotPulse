// End-to-end check of a live LotPulse deployment, using only what a phone has:
// the public Supabase URL and publishable key.
//
//   VITE_SUPABASE_URL=https://xxxx.supabase.co \
//   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_... \
//   SUPABASE_SECRET_KEY=sb_secret_... \
//   bun scripts/verify-live.ts [site URL]
//
// 1. A "watcher" (like a second phone, not signed in) subscribes to Realtime.
// 2. A "reporter" signs in anonymously, picks a scout name and reports P9.
// 3. The report is read back, and the watcher must hear it within 10 seconds.
// 4. The live site must be built with these credentials ("Live", not "Not connected").
// 5. Cleanup. Clients can never delete reports (that's the point of the RLS
//    rules), so this needs SUPABASE_SECRET_KEY (Project Settings → API Keys →
//    Secret keys). It's only read from your shell, never stored. Without it
//    the script prints the SQL to run in the SQL Editor instead.
import { createClient } from "@supabase/supabase-js";

const SITE = process.argv[2] ?? "https://lot-spotter-ai.vercel.app";
const url = process.env["VITE_SUPABASE_URL"];
const key = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_ANON_KEY"];
const secret = process.env["SUPABASE_SECRET_KEY"] ?? process.env["SUPABASE_SERVICE_ROLE_KEY"];
const REALTIME_TIMEOUT_MS = 10_000;

if (!url || !key) {
  console.error("Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY first.");
  process.exit(1);
}

let failures = 0;
function pass(message: string) {
  console.log(`  ✓ ${message}`);
}
function fail(message: string) {
  failures += 1;
  console.log(`  ✗ ${message}`);
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const watcher = createClient(url, key, options);
const reporter = createClient(url, key, options);

let reportId: string | null = null;
let userId: string | null = null;

try {
  console.log(`Supabase: ${url}`);

  // 1. Watcher subscribes, exactly like the app does.
  let heard: (id: string) => void = () => {};
  const heardIds = new Set<string>();
  const subscribed = new Promise<void>((resolve, reject) => {
    watcher
      .channel("public:reports")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reports" },
        (payload) => {
          const id = (payload.new as { id?: unknown }).id;
          if (typeof id === "string") {
            heardIds.add(id);
            heard(id);
          }
        },
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") resolve();
        else if (status !== "CLOSED")
          reject(new Error(`Realtime ${status}: ${err?.message ?? ""}`));
      });
  });
  await subscribed;
  pass("Realtime subscription is open");

  // 2. Anonymous sign-in and a scout name.
  const { data: auth, error: authError } = await reporter.auth.signInAnonymously();
  if (authError || !auth.user) {
    throw new Error(
      `Anonymous sign-in failed: ${authError?.message ?? "no user"}. Turn on "Allow anonymous sign-ins".`,
    );
  }
  userId = auth.user.id;
  pass(`Signed in anonymously (${userId})`);

  const scout = `verify_${Math.random().toString(36).slice(2, 10)}`;
  const { error: profileError } = await reporter
    .from("profiles")
    .insert({ id: userId, username: scout });
  if (profileError) throw new Error(`Creating the scout name failed: ${profileError.message}`);
  pass(`Scout name "${scout}" created`);

  // 3. Report P9, read it back, and wait for the watcher to hear it.
  const arrived = new Promise<number>((resolve, reject) => {
    const started = Date.now();
    const timer = setTimeout(
      () => reject(new Error(`no Realtime event within ${REALTIME_TIMEOUT_MS / 1000}s`)),
      REALTIME_TIMEOUT_MS,
    );
    heard = (id) => {
      if (id === reportId) {
        clearTimeout(timer);
        resolve(Date.now() - started);
      }
    };
  });

  const { data: inserted, error: insertError } = await reporter
    .from("reports")
    .insert({ lot_id: "P9" })
    .select("id, lot_id, reporter_id, created_at")
    .single();
  if (insertError || !inserted) {
    throw new Error(`Reporting P9 failed: ${insertError?.message ?? "no row"}`);
  }
  reportId = inserted.id as string;
  if (heardIds.has(reportId)) heard(reportId);
  pass(`Reported P9 (report ${reportId})`);

  const { data: readBack, error: readError } = await watcher
    .from("reports")
    .select("id, lot_id, reporter_id, profiles(username)")
    .eq("id", reportId)
    .maybeSingle();
  if (readError || !readBack)
    fail(`Reading the report back failed: ${readError?.message ?? "not found"}`);
  else if (readBack.lot_id !== "P9" || readBack.reporter_id !== userId)
    fail("Read back the wrong report");
  else pass("Another client reads the report back, with its scout name");

  try {
    const ms = await arrived;
    pass(`Realtime event arrived on the other client in ${ms} ms`);
  } catch (error) {
    fail(
      `Realtime: ${(error as Error).message}. Check that "reports" is in the supabase_realtime publication.`,
    );
  }
} catch (error) {
  fail((error as Error).message);
} finally {
  await watcher.removeAllChannels();
}

// 4. The deployed site.
try {
  const response = await fetch(SITE);
  const html = await response.text();
  const csp = response.headers.get("content-security-policy") ?? "";
  const host = new URL(url).host;
  if (!response.ok) fail(`${SITE} returned HTTP ${response.status}`);
  else if (!csp.includes(host) || html.includes("Not connected")) {
    fail(`${SITE} isn't built with these credentials yet: set the Vercel variables and redeploy`);
  } else pass(`${SITE} is built with this Supabase project (no "Not connected")`);
} catch (error) {
  fail(`Couldn't load ${SITE}: ${(error as Error).message}`);
}

// 5. Cleanup.
if (userId) {
  if (secret) {
    const admin = createClient(url, secret, options);
    const reports = await admin.from("reports").delete().eq("reporter_id", userId);
    // Deleting the user also deletes its scout name (profiles cascade).
    const user = await admin.auth.admin.deleteUser(userId);
    if (reports.error || user.error) {
      fail(`Cleanup failed: ${reports.error?.message ?? user.error?.message}`);
    } else pass("Test report, scout name and anonymous user deleted");
  } else {
    console.log(
      "\nNo SUPABASE_SECRET_KEY, so the test data is still there. Remove it in the SQL Editor:\n\n" +
        `  delete from public.reports where reporter_id = '${userId}';\n` +
        `  delete from auth.users where id = '${userId}';\n`,
    );
  }
}

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll checks passed. LotPulse is live.");
process.exit(failures ? 1 : 0);
