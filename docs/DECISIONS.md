# Decisions — VUS Resolver (Person B)

Terse log of non-obvious choices so a future session doesn't re-litigate settled calls.

- **Fixture-first build.** Every UI component is built against typed `RealtimeEvent[]`
  fixtures replayed on a timer, so the frontend never waits on Person A's pipeline. The live
  Inngest Realtime subscription is a single isolated swap at Step 9 — the `useEvidenceRun`
  hook returns the same shape in both fixture and live mode, so no component changes.

- **The Mechanism Gate is a valve, not a bar.** It is a 0..1 *multiplier*, not a level. It
  exists to suppress otherwise-strong cross-species evidence when a knockout can't speak to
  the mechanism (e.g. gain-of-function genes). Rendering it as a level bar would misrepresent
  it; it's a gauge that reads open (≈1, evidence flows) vs closed (≈0, evidence suppressed),
  and when low it visibly dampens the Cross-Species segment. This is the demo's differentiator.

- **Branch `yesh`, never `main`.** Person B works on `yesh` (pushed to origin/yesh on the
  shared VinayBhagavath/Surface repo). `main` is reserved for the final Person A + Person B
  merge. (User instruction.)

- **Next.js 16, not 14 (deliberate spec deviation).** The spec text says "Next 14" but its
  own scaffold command is `create-next-app@latest` → Next 16. Person B owns the app scaffold
  and Person A only plugs backend modules into the shared tree, so the merge surface is
  Next-version-agnostic. Chose current latest over a two-major-old app. Consequences embraced:
  Tailwind v4 (CSS-first `@theme`, no JS config) and async route `params`/`searchParams`
  (must `await` them).

- **pnpm** as package manager (spec preference; available locally).

- **shadcn pinned to 4.10.0 + `--base radix`.** 4.11.0 `init -d` is buggy: it defaults to
  Base UI, self-adds `shadcn` as a project dependency, and aborts before writing files (the
  CLI itself suggests falling back to 4.10.0). 4.10.0 + explicit `--base radix` is clean.
  The `shadcn` package legitimately remains a dependency because `radix-nova`'s generated
  `globals.css` does `@import "shadcn/tailwind.css"`.

- **Light mode, calm clinical palette.** shadcn/Vercel guidance defaults dashboards to dark;
  the spec explicitly wants a calm clinical *light* surface (muted blues/greens, generous
  whitespace). We stay in light mode and override the neutral tokens with a clinical palette.

- **`allowBuilds: false` for sharp / protobufjs / unrs-resolver** in `pnpm-workspace.yaml`.
  An undecided build script made pnpm exit non-zero when shadcn spawned it non-interactively,
  breaking `init`. None of these native builds are needed at dev time, so they're set to not
  build, which resolves the error.

## Pending cross-team items (see PROGRESS.md "Blocked on / awaiting Person A")
- `@inngest/realtime` is deprecated (Realtime folded into `inngest`); the shared
  `inngest/client.ts` may need a `// CROSS-TEAM:` deviation from the spec's import — confirm
  the current API and align with Person A at Step 1.
- `DoctorBrief` shape to be proposed to and frozen with Person A before Step 7.
