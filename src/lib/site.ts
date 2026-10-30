/** Absolute site URL (no trailing slash) for link previews and canonical links. */
export const SITE_URL = (import.meta.env.VITE_SITE_URL ?? "").replace(/\/$/, "");

/** `<link rel="canonical">` for a page path, when the site URL is known. */
export function canonical(path: string) {
  return SITE_URL ? [{ rel: "canonical", href: `${SITE_URL}${path}` }] : [];
}
