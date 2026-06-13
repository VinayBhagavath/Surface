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

- **Inngest v4 with built-in Realtime — no `realtimeMiddleware` (CROSS-TEAM).** `pnpm add inngest`
  installs inngest@4.5.1, which bundles Realtime (`inngest/realtime`) and exports no
  `realtimeMiddleware`; the standalone `@inngest/realtime@0.4.7` targets inngest **v3** and its
  middleware is type-incompatible with v4 (`middleware: Middleware.Class[]`). So
  `inngest/client.ts` is `new Inngest({ id })` with NO middleware — a deliberate deviation from
  the spec's v3 pattern. Person A must agree on the inngest major version and publish via v4's
  built-in `channel()/publish()`. Person B's Step 9 subscribe uses built-in `inngest/realtime`
  (`getSubscriptionToken`/`subscribe`).
- **Local dev needs Inngest dev mode.** inngest@4 defaults to *cloud mode* and 500s the serve
  endpoint without a signing key; the `dev` script is `INNGEST_DEV=1 next dev` so `/api/inngest`
  serves introspection locally (verified: `mode:"dev"`, HTTP 200).

- **Visual system: "clinical instrument × medical journal."** Light mode, cool-slate paper
  with a steel-teal accent; Newsreader serif for headings (journal authority) + Geist Sans
  (UI) + Geist Mono (data/IDs/scores). Confidence tokens are the single source of truth in
  `app/globals.css`. The **Mechanism Gate is a sluice valve**: a gate plate descends to choke
  an animated evidence-flow channel (handwheel on top), and a low gate desaturates + fades the
  downstream Cross-Species segment. Verified visually (gate-open vs gate-closed obvious).
- **Tailwind v4 + Turbopack stale-cache gotcha.** Adding NEW `@theme` tokens together with the
  utility classes that consume them can leave Turbopack serving a stale CSS chunk (the new
  utilities resolve to transparent — confirmed `--confidence-*` missing from compiled CSS).
  Fix: `rm -rf .next` + restart `pnpm dev`. Captured in `components/CLAUDE.md`.

- **Converged `lib/types.ts` to Person A's authoritative version (2026-06-13).** Person A pushed
  cross-team alignment + real fixtures to `yesh`. Their `types.ts` is a superset: the streaming
  types (`EvidenceFragment`, `ConfidencePipelineState`, `RealtimeEvent`) are identical to ours, and
  it adds `ConfidenceLabel`, `EvidenceSource`, `EvidenceRequestedData`, `EvidenceCard`, `RunOutput`,
  and an evolved `DoctorBrief` (`overall: ConfidenceLabel` string; `summary`/`perLayerReasons` field
  names; per-row `AcmgRow.caveat?` instead of a top-level `ps3Caveat`; +geneSymbol/suggestedFollowUp/
  generatedAt). Adopted verbatim so the FROZEN contract stays byte-identical on both sides. `/brief`
  (Step 7) is built against this shape + the real `*-output.json`.
- **Pivoted fixtures to Person A's real captured JSON.** Deleted the hand-built `kcnq1-run.ts` /
  `gate-closed-run.ts`; `fixtures/runs.ts` now wraps the real `*-run.json` (`RealtimeEvent[]`) and
  `*-output.json` (`RunOutput`) with contained `as` casts (the README-endorsed pattern for JSON
  imports). Scenario map: **ldlr** = gate-open/high · **cacna1c** = gate-closed · **kcnq1** = low.

- **Voice = browser Web Speech + Grok for reasoning.** Verified `@ai-sdk/xai` exposes only
  language/image/embedding models — **no speech/transcription**. So TTS (speak narrations) + STT
  (voice input) use the browser Web Speech API (`lib/voice/useSpeech.ts`, graceful no-op fallback);
  **Grok** (`@ai-sdk/xai` `grok-3` + `XAI_API_KEY`) powers the follow-up Q&A grounded in the run's
  evidence (`app/actions/ask-followup.ts`, returns a result object — never throws). Capability
  detection uses `useSyncExternalStore` (server snapshot = false) to avoid a hydration mismatch.
  Voice is strictly optional: text Q&A works fully without it.

## Pending cross-team items (see docs/CROSS-TEAM-ALIGNMENT.md + PROGRESS.md)
- **inngest major version — v3 vs v4 (TOP merge blocker).** Person A is verified on **v3** +
  `realtimeMiddleware` (on `backend`); Person B is on **v4** (built-in realtime, no middleware).
  The team must pick ONE before the live wiring (Step 9) / final merge: either Person B pins v3 and
  restores `realtimeMiddleware()` in `inngest/client.ts`, or Person A upgrades to v4. Does NOT block
  fixture-first UI (Steps 4–8).
