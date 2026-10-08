import type { PointerEvent } from "react";

const SPOTLIGHT_TARGETS = ".card, .lot-chip, .report-button, .campus-map";

/**
 * Pointer handler for a page root: tracks the cursor inside the hovered
 * surface as `--mx` / `--my`, which the CSS uses for a soft spotlight glow.
 */
export function trackSpotlight(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== "mouse") return;
  const target = (event.target as Element).closest<HTMLElement>(SPOTLIGHT_TARGETS);
  if (!target) return;
  const rect = target.getBoundingClientRect();
  target.style.setProperty("--mx", `${event.clientX - rect.left}px`);
  target.style.setProperty("--my", `${event.clientY - rect.top}px`);
}
