# CLAUDE.md — VUS Resolver (Research Engine / Person A)

Guidance for any future Claude (or human) working in this repo. Read this first.

## What this is

The **backend "research engine"** for a hackathon project, the **VUS Resolver**.
Given a genetic variant flagged "variant of uncertain significance" (VUS), it
autonomously gathers cross-species evidence (human predictors + gnomAD + mouse
knockout data) and produces a confidence-scored, ACMG-mapped explanation a
patient can take to a doctor. No GPU, no model training — live calls to public
genomics APIs plus reasoning calls to **Grok (xAI)**.

**This repo is Person A's half** (connectors, Inngest pipeline, confidence math,
Grok reasoning, Watcher). **Person B** owns the Next.js UI + Grok voice and
builds against the shared contract in `lib/types.ts`. There is a minimal
placeholder `app/page.tsx` Person B replaces.

**Hard constraint: NO mocked API responses, no local fallback data, no simulated
events.** A real query that returns nothing is a valid `EvidenceFragment` with
`found: false`, never a fabricated value. The Watcher polls real APIs on an
accelerated cadence — it does not fake updates. See `docs/WATCHER.md`.

## Stack

TypeScript · Next.js 14 (App Router) · **Inngest v3** (durable steps, fan-out,
cron, Realtime) · **Grok / xAI** (OpenAI-compatible API, model `grok-4.3`) ·
Vercel · vitest. Genomics APIs are all keyless and public.

> ⚠️ **Inngest is pinned to v3** (`inngest@^3`), NOT v4. `@inngest/realtime@0.4.6`
> peer-depends on `inngest@^3.42.3`; installing inngest v4 breaks the middleware
> and `createFunction` types. If you bump one, bump both compatibly.

## Pipeline (Steps 0–6) — `lib/pipeline/run-evidence-pipeline.ts`

The orchestrator is the single source of truth. It is abstracted over a
`runStep` + `publish` pair so the **same code** runs under Inngest (durable) and
under the local capture script (in-process). Steps:

- **0 — VEP router** (`ensembl-vep`): consequence type + gene + GRCh38 coords.
- **1 — gene prior** (`gnomad-constraint`): LOEUF / pLI / missense-z. Parallel with 0.
- **2 — variant effect** (`myvariant` → ClinVar + gnomAD freq + dbNSFP; `ensembl-conservation`):
  then **Grok #1 predictor-leadership** (which predictor leads + disagreement flag).
  **Early-exit** here if already-classified or population-common.
- **3 — Grok #2 Mechanism-Compatibility Gate** → `gate ∈ [0,1]`. The load-bearing
  call: can a loss-of-function mouse knockout even model this gene's disease?
- **4 — cross-species fan-out**: `ensembl-diopt` (ortholog) → `impc` (KO phenotypes
  + lethality) → `monarch` (MP↔HPO similarity).
- **5 — Grok #3 cross-species sanity check**: reads the ACTUAL MP/HPO terms (not
  just the Monarch number), handles lethality-as-signal, assigns relevance to each
  IMPC fragment (re-published as updates).
- **6 — layered confidence** (`lib/confidence/layered-model.ts`, pure) +
  **Grok #4 synthesis** → Evidence Card + Doctor Brief + ACMG rows → store →
  publish `complete` → register Watcher.

`cross_species = mechanism_gate × cross_species_raw` — the gate suppresses a
dramatic-but-irrelevant mouse phenotype (e.g. a GoF gene's lethal knockout).

## Directory map

```
lib/
  types.ts                      ← THE CONTRACT with Person B (don't drift)
  env.ts, http.ts, store.ts     ← env (lazy), fetch wrapper, run-output/watch store
  demo-variants.ts              ← the 3 real demo variants
  connectors/                   ← 7 connectors, each → EvidenceFragment[]
  reference/                    ← gene-mechanism.json, panel-to-hpo.json, acmg.ts
  grok/                         ← client + 4 reasoning prompts + narration
  confidence/layered-model.ts   ← pure function + .test.ts
  pipeline/run-evidence-pipeline.ts, config.ts
inngest/                        ← client, channels, evidence-pipeline, watcher, functions
app/                            ← layout, placeholder page, api/{inngest,test-trigger,realtime-token,brief/[runId]}
scripts/                        ← test-connectors.ts, capture-fixture.ts
fixtures/                       ← captured RealtimeEvent[] + output per demo variant (handoff)
docs/                           ← CONTRACT, HANDOFF, DEMO_VARIANTS, WATCHER, DEPLOY, DEVIATIONS
```

## Running it

```bash
# 1. env: copy .env.example → .env.local, set XAI_API_KEY (already set in this repo)
# 2. two terminals:
npm run dev          # Next.js app  (http://localhost:3000)
npm run inngest      # Inngest dev server, pointed at /api/inngest

# fire a run (no UI needed):
curl "http://localhost:3000/api/test-trigger?demo=ldlr"      # → { runId, channel, brief }
curl "http://localhost:3000/api/brief/<runId>"               # poll for output
curl "http://localhost:3000/api/test-trigger?watch=1"        # force a Watcher re-check
```

### Verifying without the full stack

```bash
npm run connectors           # live test all 7 connectors for the 3 demo variants
npm run capture [ldlr|…]     # run the FULL pipeline locally (live APIs + Grok),
                             #   print the RealtimeEvent stream, write fixtures/
npm test                     # vitest — confidence model unit tests
npm run typecheck            # tsc --noEmit
npm run build                # production build (Vercel-deployable)
```

`npm run capture` is the fastest end-to-end check — it runs the real orchestrator
in-process (same code Inngest runs) and writes `fixtures/<id>-run.json` +
`fixtures/<id>-output.json`.

## Demo variants (all real, no mocks) — `lib/demo-variants.ts`

| id | variant | context | outcome (verified live) |
|----|---------|---------|--------------------------|
| `ldlr` | LDLR p.Phe32Ser (rs879254403) | hypercholesterolemia | **HIGH** — everything agrees, gate open |
| `cacna1c` | CACNA1C p.Arg508Trp (rs776805699) | arrhythmia | gate **0.10** → cross-species **suppressed 0.07** (GoF) |
| `kcnq1` | KCNQ1 p.Ala194Val (rs2133727494) | long_qt | **LOW** — predictors disagree, no IMPC phenotype |

See `docs/DEMO_VARIANTS.md` for the real underlying numbers.

## Conventions / gotchas

- **`@/` path alias** → repo root (tsconfig `paths`, no `baseUrl`). Works in Next,
  vitest (alias in `vitest.config.ts`), and tsx.
- **Run scripts from the repo root.** tsx resolves the entry relative to CWD; a
  stray `cd` into `node_modules/...` will make `npx tsx scripts/x.ts` fail with a
  confusing `@inngest/realtime/...` not-found. (This bit me; it's not a code bug.)
- **Connectors** take a small typed input, return `EvidenceFragment[]` (some also
  return a structured `parsed`/`result`/`resolved` the pipeline reuses). They
  THROW only on HTTP failure (so Inngest retries); empty real results are
  `found: false`.
- **Grok prompts** are narrow and grounded (only the fields each step needs) and
  each ends with an explicit JSON template. Outputs are zod-validated with one
  self-repair retry (`lib/grok/client.ts`). Four reasoning calls per run, kept
  separate for auditability — never one mega-prompt.
- **Confidence model is pure** and authoritative for the `overall` label; Grok
  synthesis writes the prose and explains the label, it does not override it.
- **Realtime publishes are wrapped in `step.run`** in the Inngest adapter so a
  retry/replay never re-emits a duplicate event.
- **Store** (`lib/store.ts`): in-memory by default (fine for `next dev` + Inngest
  dev, single process); set `KV_REST_API_URL`/`KV_REST_API_TOKEN` for Vercel.

## Status

Done & verified live: all 7 connectors, 4 Grok calls, confidence model (unit
tests), full orchestrator (3 variants), full Inngest durable pipeline (event →
brief), Realtime token route, Watcher (cron + on-demand event, ran live),
production build, clean typecheck.

Person B's remaining work: the `/`, `/session/[runId]`, `/brief/[runId]`,
`/watch` routes, the `useEvidenceRun` hook (against `/api/realtime-token`), and
Grok voice. See `docs/HANDOFF.md`.
