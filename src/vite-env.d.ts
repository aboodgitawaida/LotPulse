/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Public site URL for link previews, e.g. https://lotpulse.app. Defaults to the Vercel domain. */
  readonly VITE_SITE_URL?: string;
  /** Shown on the privacy page for data deletion requests. */
  /** Cloudflare Turnstile site key (public). Its secret goes in Supabase, never here. */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  /** MapTiler key for production map tiles. Public: restrict it to your domain in MapTiler. */
  readonly VITE_MAPTILER_KEY?: string;
  // Set automatically by the Supabase ↔ Vercel integration.
  readonly NEXT_PUBLIC_SUPABASE_URL?: string;
  readonly NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
}
