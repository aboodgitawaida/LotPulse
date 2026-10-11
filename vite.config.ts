import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv } from "vite";

const TILE_HOSTS = "https://tile.openstreetmap.org https://server.arcgisonline.com";
// Cloudflare Turnstile (the bot check before a scout's first report).
const TURNSTILE = "https://challenges.cloudflare.com";

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ["VITE_", "NEXT_PUBLIC_"]), ...process.env };

  // Absolute site URL for link previews. Vercel provides the production domain.
  if (!env["VITE_SITE_URL"] && env["VERCEL_PROJECT_PRODUCTION_URL"]) {
    process.env["VITE_SITE_URL"] = `https://${env["VERCEL_PROJECT_PRODUCTION_URL"]}`;
  }

  // The browser may only talk to this site, its Supabase project and the map tiles.
  const supabaseUrl = env["VITE_SUPABASE_URL"] ?? env["NEXT_PUBLIC_SUPABASE_URL"];
  const supabase = supabaseUrl ? new URL(supabaseUrl) : null;
  const connect = supabase ? `https://${supabase.host} wss://${supabase.host}` : "";
  const csp = [
    "default-src 'self'",
    // TanStack Start inlines its hydration data as scripts.
    `script-src 'self' 'unsafe-inline' ${TURNSTILE}`,
    `frame-src ${TURNSTILE}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${TILE_HOSTS}`,
    "font-src 'self'",
    `connect-src 'self' ${connect}`.trim(),
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  return {
    server: { port: 3000 },
    // NEXT_PUBLIC_ lets the Supabase ↔ Vercel integration's public variables
    // reach the browser without renaming them. Only public keys use that prefix.
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],
    resolve: {
      tsconfigPaths: true,
      dedupe: ["react", "react-dom"],
    },
    plugins: [
      tailwindcss(),
      tanstackStart(),
      // Nitro picks its deploy preset from the environment: `vercel` on Vercel,
      // a plain Node server everywhere else (`node .output/server/index.mjs`).
      nitro({
        routeRules: {
          "/**": {
            headers: {
              ...(mode === "production" && { "Content-Security-Policy": csp }),
              "X-Content-Type-Options": "nosniff",
              "X-Frame-Options": "DENY",
              // OpenStreetMap's tile policy needs the site's origin as referrer.
              "Referrer-Policy": "strict-origin-when-cross-origin",
              "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
              "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
            },
          },
        },
      }),
      viteReact(),
    ],
  };
});
