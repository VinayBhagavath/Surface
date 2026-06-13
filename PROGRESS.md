# PROGRESS - VUS Resolver

Read this first when resuming.

## Current Status

Status: integrated on `main` after verification.

The merged repo combines Person A's backend research engine and Person B's
Next.js frontend/voice work. Integration is performed on `merge/integration`,
then `main` is moved to the verified commit and pushed.

Final Inngest decision: **v3** (`inngest@^3.54.2` plus
`@inngest/realtime@^0.4.7`) because Person A's live Realtime middleware pipeline
is verified there and v4 would require a backend publish rewrite.

## Completed Work

- Frontend intake, session stream, Evidence Trajectory, Confidence Pipeline
  strip, Doctor Brief, Watch dashboard, dev harnesses, and optional voice/Q&A.
- Backend connectors, pipeline orchestration, Grok reasoning, layered confidence
  model, Realtime token route, stored run outputs, and Watcher registration.
- Canonical shared contract from Person A in `lib/types.ts`.
- Realtime seam unified around event `vus.evidence.requested`, channel
  `vus-run-${runId}`, topic `events`.
- Normal intake now routes to the live stream and does not fall back to fixtures
  when a user submits arbitrary data.
- `/brief/[runId]?live=1` reads only real stored pipeline output and shows a
  pending state until completion.
- `/watch` reads the real Watcher store instead of static placeholder rows.

## Remaining Work

- Keep `/dev/pipeline` and `/dev/run` functional for now; remove or hide them in
  a final cleanup pass.
- Replace the `npx inngest-cli@latest` script with a locally pinned CLI package
  if offline startup becomes a requirement.
- Consider deriving the live session header gene symbol from the first VEP
  fragment once available, instead of showing the generic "Live run" label for
  arbitrary user variants.

## Merge Report

### Conflict Resolution

- `.gitignore`: unioned npm/pnpm/Next/Inngest/env/test ignores and added
  `.playwright-mcp/`.
- `CLAUDE.md`: rewritten as one merged project brief.
- `README.md`: rewritten as one merged quickstart.
- `app/api/inngest/route.ts`: backend version kept; it serves the real function
  registry.
- `app/globals.css`: frontend version kept; it owns the Tailwind v4 clinical
  design system.
- `app/layout.tsx`: frontend version kept; it owns fonts, tooltip provider, and
  toaster.
- `app/page.tsx`: frontend intake kept and changed to live-first submissions.
- `inngest/client.ts`: backend v3 client kept with `realtimeMiddleware()`.
- `inngest/functions.ts`: backend registry kept with `evidencePipeline` and
  `watcher`.
- `package.json`: dependency/script union; Inngest pinned to v3 plus
  `@inngest/realtime`.
- `tsconfig.json`: merged for Next 16/React 19 plus backend ES2022 target.
- Docs: `DECISIONS.md` and `CROSS-TEAM-ALIGNMENT.md` rewritten to preserve the
  branch decisions and mark Inngest v3 resolved.

### Test Gate Results

Verified on `merge/integration` before moving `main`.

1. `pnpm install --frozen-lockfile --config.confirmModulesPurge=false`: pass.
   `pnpm install --no-frozen-lockfile` regenerated the lockfile first; a second
   frozen install then passed.
2. `pnpm build`: pass. Required network access for `next/font` Google font
   fetches.
3. `pnpm typecheck`: pass.
4. `pnpm lint`: pass.
5. conflict-marker scan: pass with
   `grep -RIn --exclude=pnpm-lock.yaml --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.next`.
6. Route 200 checks: pass for `/`, `/session/[runId]`, `/brief/[runId]`,
   `/watch`, and `/api/inngest`.
7. Live stream end to end: pass. LDLR run `e2e-ldlr-1781387462504` streamed 33
   realtime events, including fragments, narrations, 5 pipeline updates, and
   `complete`; `/api/brief` returned 200 and `/watch` contained the run.
8. Signature demos: pass.
   - LDLR: gate `0.95`, cross-species `0.95`, overall `high`.
   - CACNA1C run `e2e-cacna1c-1781387691243`: gate `0.10`, cross-species `0.08`,
     overall `high`, proving the mechanism gate suppressed mouse evidence.
9. Watcher registration: pass. Both live helper runs and the browser-launched
   LDLR run appeared in `/watch` with stored Watcher entries.
10. Grok voice/text fallback: pass. Browser follow-up Q&A rendered a Grok answer
    grounded in the live LDLR evidence. A direct no-env server-action call
    returned the expected graceful text fallback: no crash, full app usable.

Additional checks:

- `pnpm test`: pass, 1 file / 4 tests.
- `pnpm ls inngest @inngest/realtime --depth 3`: pass with only
  `inngest@3.54.2`; `@inngest/realtime@0.4.7` also depends on `inngest@3.54.2`.
  No `inngest@4` remains in `package.json` or `pnpm-lock.yaml`.
- `/` UI smoke test clicked the LDLR launcher and landed on
  `/session/ad48fe30-04ff-4282-b3ee-c94341160783?live=1&demo=ldlr&variant=rs879254403&context=hypercholesterolemia`.
  That browser-launched run completed with brief 200, overall `high`, and a
  visible Watch entry.

## Active branch: `grok-reasoning-upload`

Goal: make the Grok/xAI layer correct (real reasoning), ship a real patient
VCF-upload + multi-variant annotation flow, prove it end-to-end on a real VCF,
and merge to `main`. Phased with hard gates.

Gate 0 (live xAI verification) — PASS. On the configured key: `grok-4.3` served;
the Responses API accepts `reasoning:{effort}` (low/medium) with structured JSON
output (`text.format` json_schema) and parses cleanly (~1.5–2s); Web Search
(`tools:[{type:"web_search"}]`) is available and returns cited answers (~12s).

Phase 1 (unify + harden the xAI client) — DONE.
- One client/config/model: everything goes through `lib/grok/client.ts` +
  `getXaiConfig()` → `grok-4.3` (via `XAI_MODEL`). `app/actions/ask-followup.ts`
  now calls the canonical `answerFollowUp`; the `@ai-sdk/xai` / `grok-3` path and
  its duplicate prompt are gone, and the dependency was removed from package.json.
- Client gained a Responses-API reasoning transport (`reasoningEffort` opt) so
  Phase 3 is just wiring; chat path unchanged for the lighter calls.
- JSON-mode fallback is now per-call/transient (no process-global latch); Zod
  validation + one self-repair retry preserved.
- Reasoning-aware timeouts (45s non-reasoning / 120s reasoning) + per-call token
  usage logging (incl. reasoning tokens), on in dev or with `GROK_DEBUG=1`.
- Honest degradation: each of the 4 pipeline Grok calls is wrapped so a failure
  after retries falls back to a deterministic, schema-valid result with an
  explicit "AI reasoning unavailable" note (`lib/grok/fallbacks.ts`). Mechanism
  gate fallback is a conservative 0.5 (never silently 1.0). Verified by
  `lib/grok/fallbacks.test.ts` (typecheck + lint + 10 tests green).

Phase 2 (real patient VCF upload + multi-variant annotation + selection) — DONE.
- `lib/vcf.ts`: dependency-free VCF parser — every record (CHROM/POS/ID/REF/ALT,
  GT→zygosity), GRCh38 `##reference`, and structured diagnostics for empty /
  not-a-VCF / header-only / all-filtered-out. Produces the VEP query per record
  (rsID, else genomic HGVS). Unit-tested (`lib/vcf.test.ts`).
- `app/actions/annotate-vcf.ts`: server action annotating every parsed record to
  gene + consequence + protein change via the existing Ensembl VEP connector
  (bounded concurrency). Raw file never leaves the browser — only parsed
  coordinates are sent; nothing persisted or logged at the variant level.
- `app/page.tsx`: upload UX with drag/drop + click, `.vcf`/`.vcf.gz` (browser
  gunzip), 25 MB cap, idle→reading→annotating→ready states, friendly specific
  errors, an in-UI privacy line, the annotated multi-variant selection list
  (gene, protein change, consequence, zygosity), an editable clinical-context
  (defaults to "cancer"), and "Investigate" → live pipeline at
  `/session/[runId]?live=1`. Demo examples preserved as replays.
- `components/SessionView.tsx`: now drives the DNA view from the live VEP
  fragment and the summary from the run's real saved output when `live`; demo
  mode unchanged. Re-added follow-up Q&A (Gate 4.6) wired to the unified
  `askFollowup` (grok-4.3) with optional browser voice.
- Gene-mechanism table: added BRCA2, MSH2, MSH6, PALB2, CHEK2, ATM, APC; flipped
  TP53 → GoF (R175 hotspots are dominant-negative/GoF → gate closes; null alleles
  noted as the LoF case).
- Verified live: parse + VEP annotation of the real `patient_PT001_raw.vcf`
  resolves all 12 variants to the correct genes (BRCA1, BRCA2×2, MLH1×2, APC,
  TP53 R175, PTEN, PALB2, CHEK2, ATM, MSH6). (VEP reports TP53 as p.Arg175Leu,
  not His — same R175 contact-residue hotspot; GoF gate-closing unaffected.)
  `pnpm build`, typecheck, lint, and 18 unit tests all green.

Phase 3 (real reasoning + scoped Live Search) — DONE.
- Reasoning mode (Responses API) on the judgment-heavy calls, keeping the
  Zod-validated wrapper contract identical (callers unchanged): mechanism gate at
  `effort: "medium"`, synthesis at `effort: "low"`. Predictor + cross-species
  stay on the chat path (grok-4.3 reasons lightly there by default). Reasoning
  calls never send presence/frequency_penalty/stop.
- xAI Live Search (`tools:[{type:"web_search"}]`) scoped to ONLY out-of-table
  genes: `lib/grok/mechanism-research.ts` researches the gene's established LoF
  vs GoF mechanism with citations; the pipeline feeds that into the gate (labeled
  "[Mechanism researched from published literature — not the curated table]") and
  emits a cited narration + trajectory line. In-table genes trust the table (no
  search). Europe PMC literature pass kept for synthesis grounding.
- `webSearchEnabled()` (XAI_WEB_SEARCH, on by default) gates it — with search
  off the pipeline still runs (research is additive); empty/error research keeps
  the conservative gate and never invents a mechanism.
- Verified live: reasoning gate closes a GoF gene (TP53 → gate 0.10, ~2s, valid
  JSON); out-of-table NF1 research returns LoF + found:true with 16 real
  citations (ClinGen/GeneReviews/OMIM), ~8s. build, typecheck, lint, tests green.

Phase 4 (end-to-end live test on the real VCF) — DONE.
- Added `public/samples/patient_PT001_raw.vcf` (synthetic 12-variant fixture;
  also selectable in the UI). build, typecheck, lint, 18 unit tests green.
- Routes 200: `/`, `/session/[runId]`, `/brief/[runId]`, `/watch`,
  `/api/inngest`, and the served fixture.
- Upload UX (browser): the page renders, accepts the VCF, and the live VEP
  annotation resolves all 12 variants to the correct genes (BRCA1, BRCA2×2,
  MLH1×2, APC, TP53, PTEN, PALB2, CHEK2, ATM, MSH6).
- Live pipeline science (ran the real `runEvidencePipeline` — the same code the
  Inngest function calls — against live genomics APIs + live Grok):
  - **TP53 rs28934578 — gate CLOSES (0.10)**: GoF/dominant-negative, the
    preweaning-lethal mouse knockout is correctly SUPPRESSED; brief explains why.
    ACMG PM1/PM2/PP2/PP3. The differentiator survives end-to-end.
  - **MSH6 — gate OPEN (0.90)** (LoF frameshift, PVS1/PM2); **ATM — gate OPEN
    (0.90)** (LoF). Both coherent.
  - **BRCA1 rs80357064 / MLH1 rs63750447 early-exit**: real ClinVar says "Likely
    pathogenic" / "Benign", so they are correctly NOT treated as VUS (no
    fabrication). This is an honest real-data deviation from the task's "BRCA1
    gate-open + PS3" expectation — that variant simply isn't a VUS. No PS3
    model-organism ACMG row appeared on any VUS because cross-species evidence was
    low or gate-suppressed for all of them (honest — PS3 only with real support).
  - Forced Grok failure (bad model) on TP53 → still a rendered brief, gate 0.5
    (never 1.0), "AI reasoning unavailable" notes, no fabricated ACMG, no crash.
  - Follow-up Q&A via the unified grok-4.3 client: grounded + honest; voice optional.

## Last Commit

Integration merge commit on `main`; see `git log -1 --oneline` for the final
hash after push.
