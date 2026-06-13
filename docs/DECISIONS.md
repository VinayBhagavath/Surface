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
- **One xAI client + one model.** All Grok calls go through `lib/grok/client.ts`
  (`openai` SDK → `api.x.ai/v1`, config from `getXaiConfig()`); the single model
  is `grok-4.3` via `XAI_MODEL`. The former `@ai-sdk/xai` / `grok-3` follow-up
  path was removed (dependency dropped) — `askFollowup` now calls the canonical
  `answerFollowUp` on the same client.

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

## Grok reasoning, Live Search & degradation (`grok-reasoning-upload`)

- **Reasoning mode is Responses-API only** (verified live on the key in Gate 0).
  Shape:

  ```
  client.responses.create({
    model: "grok-4.3",
    instructions: <system + "respond with ONLY one JSON object">,
    input: [{ role: "user", content: <user> }],
    reasoning: { effort: "low" | "medium" | "high" },
    max_output_tokens: <json budget + ~2500 reasoning headroom>,
  }, { timeout: 120_000 })
  ```

  Then read `res.output_text`, pull the first balanced `{...}`, `JSON.parse`,
  Zod-validate, with one self-repair retry. The wrapper contract is identical to
  the chat path, so callers don't change which transport ran. **Reasoning calls
  must not send `presence_penalty` / `frequency_penalty` / `stop`** (the API
  rejects them).
- **Effort levels.** Mechanism gate = `medium` (load-bearing judgment), synthesis
  = `low` (writes from given data; favour responsiveness). Predictor leadership
  and cross-species stay on `chat.completions` json_object mode — `grok-4.3`
  already reasons lightly there, and they mostly read provided numbers.
- **Timeout posture.** Non-reasoning calls 45 s, reasoning calls 120 s (client +
  matching tolerance); the singleton client also has a 120 s ceiling.
- **JSON-mode fallback is per-call/transient**, not a process-global latch — one
  transient `response_format` error retries that call without json mode and does
  not downgrade later calls.
- **Graceful, honest degradation.** Each of the four pipeline Grok calls is
  wrapped (`lib/grok/fallbacks.ts`): a failure after retries substitutes a
  deterministic, schema-valid result computed from the same real numbers, with an
  explicit "AI reasoning unavailable" note. The **mechanism gate fails to a
  conservative `0.5`, never `1.0`**. No fabricated ACMG rows in the fallback.
- **Live Search (`web_search`) is scoped + additive.** It runs ONLY when the gene
  is absent from the curated mechanism table (`lib/grok/mechanism-research.ts`),
  returns the parsed mechanism plus real `url_citation` annotations, and feeds the
  gate labeled "[Mechanism researched from published literature — not the curated
  table]". `webSearchEnabled()` (`XAI_WEB_SEARCH`, on by default) gates it; with
  it off, or an empty/failed search, the gate stays cautious and the run still
  completes. Empty searches say so; nothing is invented. Europe PMC literature is
  unchanged and still grounds synthesis.
- **Gene-mechanism table coverage.** Added the hereditary-cancer genes BRCA2,
  MSH2, MSH6, PALB2, CHEK2, ATM, APC. **TP53 is marked `GoF`**: the recurrent
  R175/R248/R273 missense hotspots are dominant-negative/gain-of-function, so a
  `Trp53`-null knockout (however dramatic) cannot model them and the gate must
  CLOSE. (Truncating/null TP53 alleles are LoF; the table treats the
  missense-hotspot interpretation as GoF — noted in the entry.)

## Patient upload & VCF flow (`grok-reasoning-upload`)

- **Intake is upload-first and real.** `app/page.tsx` reads the VCF in the browser
  (gunzipping `.vcf.gz` via `DecompressionStream`), parses every record
  (`lib/vcf.ts`), annotates each to gene + consequence via Ensembl VEP
  (`app/actions/annotate-vcf.ts`), and shows a selection list. The chosen variant
  runs the real live pipeline at `/session/[runId]?live=1`. The earlier
  demo-matching `resolveVariant` (file → one of three demos, else fallback) was
  replaced; the three sample demos remain as fixture replays under "see a finished
  example".
- **Privacy posture, kept truthful.** The raw file never leaves the browser; only
  the parsed coordinates needed for the VEP lookup are sent to the server action,
  nothing is persisted, and no variant-level data is logged. The in-UI assurance
  matches this exactly.
- **Real-data honesty in the demo VCF.** In `patient_PT001_raw.vcf`, BRCA1
  (`rs80357064`) and MLH1 (`rs63750447`) are already classified in ClinVar
  (Likely pathogenic / Benign), so the pipeline correctly early-exits them as
  not-a-VUS rather than forcing a gate/cross-species story. TP53 (`rs28934578`,
  VEP calls it p.Arg175Leu — same R175 hotspot) is the gate-CLOSE differentiator;
  MSH6/ATM are gate-OPEN VUS.
