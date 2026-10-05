// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    optimizeDeps: {
      // Prebundle the dashboard dependencies with React before the first page
      // loads. Reject stale optimizer requests instead of mixing React runtimes
      // across a dependency refresh (which leaves the hook dispatcher null).
      include: [
        "@radix-ui/react-dialog",
        "@radix-ui/react-slot",
        "class-variance-authority",
        "clsx",
        "lucide-react",
        "tailwind-merge",
      ],
      ignoreOutdatedRequests: false,
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      dedupe: ["react", "react-dom"],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    },
  },
});
