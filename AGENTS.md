<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Application rules
- Keep LotPulse dashboard interactions in client-side React state; report, prediction and payment data are explicitly simulated, not live integrations.
- Define LotPulse visual roles and control variants in the global design system; reusable radar illustrations belong in dedicated components.
- Prebundle dashboard UI dependencies with React and reject outdated Vite optimizer requests; mixed optimizer generations can create a second React runtime and crash hooks.

- Campus map uses the managed Google Maps connector (browser key + tracking channel env vars) with markers from src/lib/campus-lots.ts; the old schematic SVG radar was removed. Why: real UTM geography beats a decorative schematic, and shared lot data keeps map, dashboard and forecast in sync.
