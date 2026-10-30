import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { SITE_URL } from "@/lib/site";
import appCss from "../styles.css?url";

const SITE_TITLE = "LotPulse · UTM Parking Radar";
const SITE_DESCRIPTION =
  "Live parking enforcement reports from UTM students. See where enforcement was last spotted, lot by lot.";
const OG_IMAGE = `${SITE_URL}/og.png`;
// Open the connection to Supabase while the app's JavaScript is still loading.
const SUPABASE_ORIGIN = (() => {
  const url = import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
})();
// Structured data so search engines know what LotPulse is.
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "LotPulse",
  description: SITE_DESCRIPTION,
  ...(SITE_URL && { url: `${SITE_URL}/`, image: OG_IMAGE }),
  applicationCategory: "TravelApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript",
  offers: { "@type": "Offer", price: "0", priceCurrency: "CAD" },
  audience: { "@type": "Audience", audienceType: "University of Toronto Mississauga students" },
};

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
      { property: "og:site_name", content: "LotPulse" },
      ...(SITE_URL ? [{ property: "og:url", content: `${SITE_URL}/` }] : []),
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "LotPulse, the UTM parking radar" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: SITE_TITLE },
      { name: "twitter:description", content: SITE_DESCRIPTION },
      { name: "twitter:image", content: OG_IMAGE },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
    ],
    links: [
      ...(SUPABASE_ORIGIN ? [{ rel: "preconnect", href: SUPABASE_ORIGIN }] : []),
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
    scripts: [{ type: "application/ld+json", children: JSON.stringify(STRUCTURED_DATA) }],
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
  useEffect(() => {
    document.title = "Page not found · LotPulse";
  }, []);
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
