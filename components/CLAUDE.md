# /components conventions (auto-loaded when working in this subtree)

- **Confidence colors come ONLY from the `--confidence-*` tokens** in `app/globals.css`
  (gray = pending · amber = low · blue = moderate · green = high). Never hardcode hex/oklch
  for a confidence value. Use the **literal** Tailwind classes — `bg-confidence-high`,
  `text-confidence-moderate-ink`, `bg-confidence-low-soft`, etc. Tailwind v4 only generates
  utilities it can SEE as literal strings in source, so NEVER build a confidence class name
  by interpolation (`bg-confidence-${level}` will silently produce no styles).

- **The Mechanism Gate renders as a VALVE/gauge, never a level bar** — it is a 0..1
  *multiplier*. Open (≈1) = evidence flows; closed (≈0) = evidence suppressed, and a closed
  gate must visibly dampen the downstream Cross-Species segment. See
  `ConfidencePipelineStrip.tsx` (the sluice-gate channel).

- **Gotcha:** after adding NEW `@theme` tokens together with the utility classes that use
  them, Turbopack's cache can go stale and the new utilities render transparent. Fix:
  `rm -rf .next` and restart `pnpm dev` (a plain reload is not enough).

- shadcn primitives live in `components/ui/*` — compose them, don't reinvent. `Tooltip`
  relies on the app-level `TooltipProvider` (already in `app/layout.tsx`).
