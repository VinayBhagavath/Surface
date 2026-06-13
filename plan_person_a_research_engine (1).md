# VUS Resolver — Build Plan: Research Engine (Person A)

You own everything that doesn't render — the connectors, the Inngest
pipeline, the layered confidence math, and all five Grok reasoning calls.
Your teammate owns the Next.js app, the live UI, and voice. The seam between
you is small and defined below first — agree on it together before splitting
off, since it's the only thing that causes merge pain if it drifts.

## The Shared Contract (do this together, ~30 min, before splitting)

Create `/lib/types.ts` together and don't let it diverge:

```ts
export type EvidenceFragment = {
  id: string;                 // stable per-fragment id, e.g. "step2-myvariant"
  source: "ensembl_vep" | "gnomad_constraint" | "myvariant" | "ensembl_conservation"
        | "ensembl_diopt" | "impc" | "monarch_phenodigm";
  step: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  queryTime: string;
  found: boolean;
  summary: string;             // one-line, human-readable, this is what renders in the card
  raw: Record<string, unknown>;
  relevance?: "high" | "medium" | "low" | "unscored";
};

export type ConfidencePipelineState = {
  genePrior: { value: number; label: "low" | "moderate" | "high"; reason: string } | null;
  variantEffect: { value: number; label: "low" | "moderate" | "high"; reason: string } | null;
  mechanismGate: { value: number /* 0..1 */; reason: string } | null;
  crossSpecies: { value: number; label: "low" | "moderate" | "high"; reason: string } | null;
  overall: { label: "low" | "moderate" | "high"; reason: string } | null;
};

export type RealtimeEvent =
  | { type: "fragment"; data: EvidenceFragment }
  | { type: "narration"; data: string }              // Grok's spoken-aloud commentary
  | { type: "pipeline_update"; data: ConfidencePipelineState }
  | { type: "complete"; briefUrl: string };
```

Also agree on these now — they're the only other cross-boundary surface:

- **Inngest event name**: `vus.evidence.requested`, payload `{ runId, variant: string /* HGVS or rsID */, clinicalContext: string }`.
- **Realtime channel name**: `vus-run-${runId}` — you publish `RealtimeEvent`s to it, your teammate subscribes.
- **Output of a completed run**: you write the final `EvidenceCard` + `DoctorBrief` content (plain objects, agree on a `DoctorBrief` type too — ACMG rows as `{ code: string; direction: "pathogenic" | "benign"; strength: string; fact: string }[]`) to wherever the frontend's `/brief/[runId]` route reads from (simplest: an Inngest step writes it, frontend fetches by `runId` — agree on the read path, e.g. a small KV or just re-fetch via an Inngest function invocation).

Once these are pinned, you can work almost entirely independently.

## What You're Building

### 1. Connector modules — `/lib/connectors/`

Seven modules, each takes minimal input and returns `EvidenceFragment[]` (some
return more than one fragment, e.g. MyVariant returns ClinVar + gnomAD freq +
dbNSFP as separate fragments). Build and test each one **standalone** against
the live API before wiring into Inngest — this is the fastest way to avoid
debugging API-shape issues inside a step function.

- `ensembl-vep.ts` — consequence type for the variant (Step 0 router input).
- `gnomad-constraint.ts` — gene-level LOEUF/pLI/missense-z (Step 1).
- `myvariant.ts` — ClinVar status, gnomAD frequency, dbNSFP bundle
  (AlphaMissense, REVEL, CADD, EVE, SpliceAI) (Step 2). This is your highest-
  value connector — get it working first.
- `ensembl-conservation.ts` — per-residue conservation score (Step 2).
- `ensembl-diopt.ts` — ortholog identification + DIOPT confidence rank + %
  identity (Step 4).
- `impc.ts` — zygosity-matched KO phenotype + viability/lethality flag
  (Step 4). Second-highest priority — has the most idiosyncratic response
  shape, start early.
- `monarch.ts` — MP↔HPO similarity score, given the gene's MP terms and the
  patient's HPO terms (Step 4).

### 2. Reference data — `/lib/reference/`

Two small static JSON files you author by hand (these are reference data, not
fallbacks — code constants the same way the ACMG table is a code constant):

- `gene-mechanism.json` — per-gene: `{ inheritanceMode: "dominant" | "recessive",
  mechanism: "LoF" | "GoF" | "both", notes: string }`. You only need entries for
  your demo variants' genes (KCNQ1 + the gate-closing variant's gene) plus a
  handful more for robustness. Source from ClinGen gene-disease validity
  curations.
- `panel-to-hpo.json` — maps the clinical-context strings the intake form
  offers (cardiomyopathy, immune, neurodevelopmental, etc.) to HPO term IDs,
  for Monarch's HPO side.

### 3. Inngest pipeline function — `/inngest/evidence-pipeline.ts`

This is the core deliverable. Implement Steps 0–6 from the architecture as
`step.run()` calls, publishing a `RealtimeEvent` after each one resolves:

- Step 0 (router) + Step 1 (gnomAD constraint) fire in parallel.
- Early-exit check after Steps 0/1/2 (LoF-tolerant + high frequency → short
  output, skip to a minimal synthesis).
- Step 2 fan-out (MyVariant + conservation), then the predictor-leadership
  Grok call.
- Step 3 — Mechanism Gate Grok call, publish `pipeline_update` immediately
  with the gate value and reason.
- Step 4 — three-way fan-out (Ensembl+DIOPT, IMPC, Monarch).
- Step 5 — cross-species sanity-check Grok call (gets actual MP/HPO term text,
  not just the score).
- Step 6 — layered confidence math (`/lib/confidence/layered-model.ts`, pure
  function, easy to unit-test independently) + final synthesis Grok call →
  Evidence Card + Doctor Brief → write output → publish `complete`.
- On completion, trigger Watcher registration (send a second event or directly
  schedule — see below).

### 4. Watcher — `/inngest/watcher.ts`

Per-variant scheduled function. Re-runs MyVariant (ClinVar status) + IMPC
against live APIs, diffs against the stored Step-6 snapshot, publishes a
`fragment`/`narration` update to `vus-run-${runId}` either way ("no change" or
"update found"). Make the interval a config constant — short for demo, easy to
change for "production" framing. Build this last; it reuses connectors you
already have.

### 5. Grok reasoning calls — `/lib/grok/`

Five prompt templates, each a small function `(context) => Promise<...>`:
predictor-leadership (Step 2), mechanism gate (Step 3), cross-species sanity
check (Step 5), layered synthesis + ACMG mapping (Step 6), and the narration
wrapper that turns any of the above into a short spoken-aloud line for voice.
Keep each prompt narrow — pass only the specific fields it needs, not the
whole trajectory. Write these against a couple of hand-picked real API
responses (capture them once, reuse as fixtures for prompt iteration) so
you're not burning live API calls every time you tweak a prompt.

## Suggested Order

1. Shared contract (together).
2. `myvariant.ts` + `ensembl-vep.ts` — get real data flowing for your demo
   variant (KCNQ1) immediately, so you have something to hand your teammate.
3. Pipeline skeleton with Steps 0–2 wired and Realtime publishing — **this
   unblocks your teammate's Realtime hook work**, even before Steps 3–6 exist.
4. Remaining connectors (`impc.ts` next — most idiosyncratic).
5. Grok calls, one per step, in order (3, 2's predictor call, 5, 6).
6. Layered confidence model as a pure function — write this with unit tests
   against the two demo variants (KCNQ1 should land "high," the gate-closing
   variant should land with `mechanismGate` near 0 despite a strong
   cross-species raw score).
7. Watcher, last.

## What to Hand Your Teammate, and When

- **Immediately**: the `EvidenceFragment` / `ConfidencePipelineState` /
  `RealtimeEvent` types (above).
- **As soon as Step 0–2 work**: one captured real run's worth of
  `RealtimeEvent`s as a JSON fixture (an array, in order) — your teammate uses
  this to build the Evidence Trajectory UI before your full pipeline is done,
  then swaps the fixture for the live subscription with zero component
  changes, since the shape is identical.
- **By mid-point**: the `DoctorBrief` type and one real example output for
  KCNQ1, so `/brief/[runId]` can be built against real content.
