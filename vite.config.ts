import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 3000 },
  resolve: {
    tsconfigPaths: true,
    dedupe: ["react", "react-dom"],
  },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    // Nitro picks its deploy preset from the environment: `vercel` on Vercel,
    // a plain Node server everywhere else (`node .output/server/index.mjs`).
    nitro(),
    viteReact(),
  ],
});
