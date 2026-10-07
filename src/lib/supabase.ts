import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public browser credentials (the anon/publishable key is safe to ship; row
// level security in supabase/migrations decides what it can do). Without them
// the app runs in demo mode with simulated sightings.
const env = import.meta.env;
const url = env.VITE_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  env.VITE_SUPABASE_ANON_KEY ??
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
