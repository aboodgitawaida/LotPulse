import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public browser credentials (the anon/publishable key is safe to ship; row
// level security in supabase/migrations decides what it can do). Without them
// the app runs "offline": it shows no reports and reporting is disabled.
// Read each variable by name: touching `import.meta.env` as a whole makes Vite
// ship every VITE_ variable in the bundle, used or not.
export const SUPABASE_URL: string | undefined =
  import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  SUPABASE_URL && key ? createClient(SUPABASE_URL, key) : null;
