# Decisions - VUS Resolver

Merged decision log. Keep this terse and append-only unless correcting an
inaccuracy.

## Integration Decisions

- **Inngest standardized on v3.** The merged repo uses `inngest@^3.54.2` with
  `@inngest/realtime@^0.4.7` and `realtimeMiddleware()`. Person A's durable
  pipeline and live stream were verified on v3; Person B's v4 branch could
  subscribe only after rebuilding the backend publish path because v4 removed the
  middleware API. For this merge, preserving the verified live pipeline is lower
  risk than porting the backend to v4.
- **Next.js 16 and React 19 are retained.** Person B owns the UI scaffold and
  the backend modules are framework-agnostic. App Router params/searchParams are
  promise-based per the installed Next docs.
- **`lib/types.ts` is Person A's canonical contract.** Frontend code adapts to
  `RunOutput`, `DoctorBrief.summary`, `perLayerReasons`, `overall:
  ConfidenceLabel`, and per-row `AcmgRow.caveat`.
- **`inngest/functions.ts` is Person A's registry.** It exports
  `[evidencePipeline, watcher]`; the serve route uses that registry.
- **Normal intake is live-first.** `/` emits `vus.evidence.requested` and routes
  to `/session/<runId>?live=1`. Captured fixtures remain available for demo/dev
  harnesses, but real user runs must not display fixture output as if it were
  live evidence.
- **One package manager and lockfile.** Use pnpm and `pnpm-lock.yaml`; remove the
  backend npm lockfile during integration.

## Product/Data Decisions

- **No fabricated evidence.** Empty public API results render as real
  `found:false` evidence. The app must not synthesize local fallback data to make
  a run look successful.
- **Fixture-first UI was allowed during parallel development.** Fixtures are
  captured real pipeline runs (`RealtimeEvent[]` and `RunOutput`) and remain
  valid for `/dev/run`, `/dev/pipeline`, and demo fallback development. They are
  not the normal path for arbitrary submitted variants.
- **The Mechanism Gate is a valve, not a bar.** It is a 0..1 multiplier that can
  suppress otherwise dramatic mouse evidence when the model organism mechanism
  does not match the human disease mechanism.
- **Contract is v2, not the original v1 prompt.** The merged app uses seven
  evidence sources, stable fragment IDs, `pipeline_update`, and
  `complete{briefUrl}` as documented in `lib/types.ts` and `docs/CONTRACT.md`.
- **Demo genes are driven by real data.** LDLR became the high-confidence lead
  because it has real rich IMPC support. CACNA1C demonstrates the gate-closing
  case. KCNQ1 remains the honest low-confidence case because real IMPC has no
  significant Kcnq1 knockout phenotype.
- **Low gene prior is not hidden.** LDLR and KCNQ1 have low constraint by gnomAD
  metrics; the model reports that truthfully instead of inflating gene prior.

## Backend/Pipeline Decisions

- **The deterministic confidence model owns `overall`.** Grok writes synthesis
  prose and ACMG explanations but does not override the computed label.
- **Grok calls stay narrow and grounded.** The pipeline uses separate reasoning
  calls for predictor leadership, mechanism gate, cross-species sanity, and
  synthesis. Prompts consume actual connector outputs and zod-validate JSON.
- **Connector degradation must be honest.** DIOPT is best-effort; Ensembl
  homology supplies the mouse symbol when DIOPT is unavailable. Monarch v3 IC
  scores are bucketed instead of treated as a 0..1 phenodigm. MyVariant arrays
  are normalized by documented rules.
- **Pipeline step 4 is partly sequential.** Ortholog discovery precedes IMPC and
  Monarch because those calls require the mouse gene and MP terms.
- **IMPC relevance is folded into cross-species sanity.** Re-published fragments
  update by stable `id` after relevance is assigned.
- **Watcher has cron and event triggers.** Cron is the production cadence; the
  `vus.watch.recheck` event remains the verified/demo trigger.
- **Grok backend model is configurable.** Backend defaults to `grok-4.3` through
  `XAI_MODEL`; voice/follow-up Q&A uses AI SDK/xAI and remains optional.

## Frontend/UI Decisions

- **Clinical light visual system.** The UI uses a calm clinical palette, light
  mode, Newsreader headings, Geist UI/mono fonts, Tailwind v4 tokens, and shadcn
  primitives.
- **Confidence colors are semantic.** Pending gray, low amber, moderate blue,
  high green. Tokens live in `app/globals.css`.
- **shadcn remains pinned by generated output.** The project keeps the generated
  radix/shadcn dependencies and CSS imports that the UI requires.
- **Voice is optional.** Browser Web Speech handles TTS/STT when available.
  Missing voice APIs or missing `XAI_API_KEY` must leave text workflows usable.
- **Tailwind/Turbopack stale cache is known.** If new `@theme` tokens render
  transparent, remove `.next` and restart `pnpm dev`.
