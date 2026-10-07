import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "../styles.css?url";

const SITE_TITLE = "LotPulse · UTM Parking Radar";
const SITE_DESCRIPTION =
  "Predictive parking radar for UTM students. Lot-by-lot patrol forecasts and student scout reports.";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0b0d12" },
      { name: "color-scheme", content: "dark" },
      { title: SITE_TITLE },
      { name: "description", content: SITE_DESCRIPTION },
      { property: "og:title", content: SITE_TITLE },
      { property: "og:description", content: SITE_DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..700&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
    ],
  }),
  shellComponent: RootShell,
  component: Outlet,
  notFoundComponent: NotFound,
  errorComponent: RootError,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function StatusPage({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <main className="status-page">
      <h1>{title}</h1>
      <p>{body}</p>
      <div className="status-page-actions">{children}</div>
    </main>
  );
}

function NotFound() {
  return (
    <StatusPage
      title="Off the radar"
      body="That page doesn't exist. Head back to the campus radar."
    >
      <Link to="/" className="status-page-primary">
        Back to radar
      </Link>
    </StatusPage>
  );
}

function RootError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  console.error(error);
  return (
    <StatusPage
      title="Signal lost"
      body="Something went wrong loading LotPulse. Try again in a moment."
    >
      <button
        type="button"
        className="status-page-primary"
        onClick={() => {
          void router.invalidate();
          reset();
        }}
      >
        Try again
      </button>
      <a href="/" className="status-page-secondary">
        Go home
      </a>
    </StatusPage>
  );
}
