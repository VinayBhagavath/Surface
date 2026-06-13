# Integration Contract (Person A ↔ Person B)

The ONLY surfaces that cause merge pain if they drift. All shapes live in
[`lib/types.ts`](../lib/types.ts) — that file is the source of truth.

## Types

- `EvidenceFragment` — one piece of evidence. Fields: `id` (stable, e.g.
  `step2-myvariant-clinvar`), `source` (7-value enum), `step` (0–6), `queryTime`,
  `found`, `summary` (renders directly in the card), `raw`, `relevance?`.
  **A later fragment with the same `id` is an UPDATE, not a duplicate** — this is
  how IMPC fragments get their `relevance` filled in after Step 5.
- `ConfidencePipelineState` — `genePrior`, `variantEffect`, `mechanismGate`
  (value in [0,1], no label — it's a multiplier), `crossSpecies`, `overall`.
  Each non-gate layer is `{ value, label, reason } | null`.
- `RealtimeEvent` — `{type:"fragment"|"narration"|"pipeline_update"|"complete"}`.
  `complete` carries `briefUrl` (string), not the payload.
- `DoctorBrief` / `EvidenceCard` / `AcmgRow` — the stored output. ACMG rows are
  `{ code, direction:"pathogenic"|"benign", strength, fact, caveat? }`.

## Event

```ts
inngest.send({ name: "vus.evidence.requested",
  data: { runId, variant /* HGVS or rsID */, clinicalContext } });
```

`clinicalContext` should be one of the keys in
[`lib/reference/panel-to-hpo.json`](../lib/reference/panel-to-hpo.json) (e.g.
`hypercholesterolemia`, `arrhythmia`, `cardiomyopathy`, `neurodevelopmental`, …)
— the `labels` block there gives the human-readable dropdown text for intake.

## Realtime

- Channel: **`vus-run-${runId}`**, topic **`events`**, payload `RealtimeEvent`.
- Get a scoped subscription token from **`GET /api/realtime-token?runId=…`** →
  `{ channel, topics:["events"], key }`. Pass it to `useInngestSubscription`
  (`@inngest/realtime/hooks`).
- Event order per run: `narration(start)` → `fragment(step0)` → … →
  `pipeline_update` (fills genePrior, then variantEffect, then mechanismGate,
  then the full state with `overall`) → `complete`. `pipeline_update` fires after
  Step 3 (gate) and again at the end — drive the Confidence Pipeline strip off it.

## Output read path

- Pipeline writes `{ evidenceCard, doctorBrief }` to the store on completion.
- **`GET /api/brief/${runId}`** returns it (404 until complete). `/brief/[runId]`
  and `/session` read from here.

## Fixtures (build the UI without the backend running)

- `fixtures/<id>-run.json` — the ordered `RealtimeEvent[]` for a full run. Replay
  it on a timer to simulate the live stream; the shape is identical to the real
  subscription, so swapping in the live hook is a one-line change.
- `fixtures/<id>-output.json` — a real `{ evidenceCard, doctorBrief }` to build
  `/brief` against.
- Available ids: `ldlr` (high), `cacna1c` (gate-closing), `kcnq1` (low).
