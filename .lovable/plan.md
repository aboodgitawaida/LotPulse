# LotPulse: Real Campus Map + Threat Forecast

## What we'll build

### 1. Replace the schematic radar with a real Google Map
- Connect Google Maps Platform (Managed by Lovable — one-click setup, no key needed from you).
- Interactive dark-styled map centered on the real UTM campus in Mississauga.
- Accurate markers for the real lots: P9, P4, P8, and Inner Circle, each glowing in its threat color (red/amber/green).
- Tapping a marker selects that lot and updates the whole dashboard, same as today.
- Keep the radar sweep/glow styling overlaid so it still feels like LotPulse, not a generic map.
- The expanded map dialog gets the real map too.

### 2. Threat forecast graph
- New card under the focus lot showing an hour-by-hour predicted threat curve (6 AM – 11 PM) for the selected lot.
- Smooth area/line graph with glowing accent, a "now" marker, and the peak patrol window highlighted (matching the existing prediction text).
- Each lot gets its own plausible curve shape (P9 peaks midday, P8 stays low, etc.). Data stays simulated, consistent with the rest of the app.
- Updates instantly when switching lots.

## Technical details
- Google Maps loads via the browser key (`VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`) with `loading=async` and an init callback; map renders behind `<ClientOnly>` with a radar-styled skeleton fallback so SSR stays clean.
- Default `google.maps.Marker` (no mapId), `clickableIcons: false`, dark map style via `styles` array.
- Forecast graph: pure SVG component in the existing design system, no chart library.
- One-time step: a connect card will appear for Google Maps — approve it and the map works immediately.
