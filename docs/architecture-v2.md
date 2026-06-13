# Architecture — VUS Resolver

## One-line
A variant + clinical context goes in; an Inngest-orchestrated, Grok-reasoned evidence
pipeline streams `RealtimeEvent`s back over Inngest Realtime; the UI renders them live as an
"evidence trajectory" with a four-layer confidence pipeline, and writes out a printable
Doctor Brief.

## End-to-end data flow
```
/  (intake)
  └─ startRun({ runId, variant, clinicalContext })           [Server Action, Person B]
       └─ inngest.send("vus.evidence.requested", input)
            └─ evidence pipeline (Inngest functions)          [Person A]
                 ├─ queries connectors (VEP, gnomAD, MyVariant, conservation,
                 │   DIOPT, IMPC, Monarch)  → EvidenceFragment per source
                 ├─ Grok narration + layered confidence math  → ConfidencePipelineState
                 └─ publish RealtimeEvent[] to channel runChannel(runId)
                      └─ /session/[runId] subscribes          [Person B]
                           useEvidenceRun(runId) accumulates → renders:
                             • ConfidencePipelineStrip (header)
                             • Evidence Trajectory (right pane)
                             • Conversation / narrations (left pane, voice backbone)
                      └─ on "complete" → /brief/[runId] reads DoctorBrief (read-model)
```
The intake event emit works even before Person A's function exists (Inngest just queues it).

## The contract (the only thing the two sides truly share)
`/lib/types.ts` + `/lib/realtime-constants.ts` — frozen, byte-for-byte identical on both
sides. Person B consumes these shapes; Person B never computes confidence or fetches evidence.

`RealtimeEvent` (the live wire format):
- `{ type: "fragment", data: EvidenceFragment }` — one evidence card (source, step, summary,
  raw, optional relevance).
- `{ type: "narration", data: string }` — a human-readable line for the conversation pane.
- `{ type: "pipeline_update", data: ConfidencePipelineState }` — partial confidence state;
  merged into the running pipeline.
- `{ type: "complete", briefUrl }` — run finished; brief available.

## The confidence model (four layers + a gate)
1. **Gene Prior** — how constrained/important the gene is (e.g. LoF-intolerant).
2. **Variant Effect** — does this specific change look damaging (AlphaMissense, conservation, ClinVar, frequency).
3. **Mechanism Gate** (0..1 multiplier) — does the variant behave like the mechanism the
   cross-species model can speak to? A predicted loss-of-function matching a knockout → gate
   open (≈1). A gain-of-function gene where a knockout says nothing → gate closed (≈0).
4. **Cross-Species** — what the mouse ortholog knockout phenotype shows, mapped to the
   clinical question.
**Overall** = the layers combined, with the gate suppressing cross-species when closed. The
gate is the key insight: a dramatic mouse signal must be *correctly discounted* when the
mechanism doesn't transfer. The UI renders the gate as a valve and visibly dampens the
Cross-Species segment when the gate is low.

## Frontend layering (Person B)
- `useEvidenceRun(runId, { source })` — the single seam between data and UI. Returns
  `{ fragments, pipeline, narrations, complete, briefUrl }`. `source: "fixture"` replays a
  typed `RealtimeEvent[]` on a timer; `source: "live"` subscribes to Inngest Realtime. Same
  return shape → swapping is a one-liner (Step 9).
- Components depend only on the hook's return shape, never on the data source.
- The Doctor Brief is a separate read-model (`DoctorBrief`) written by Person A's synthesis
  step; `/brief/[runId]` renders it and is print-optimized.

## Merge boundary
Person B owns `/app`, `/components`, `/lib/voice`, `/lib/useEvidenceRun.ts`, `/fixtures`, and
the theme. Person A owns `/lib/connectors|grok|confidence|reference` and the Inngest pipeline/
watcher functions. The two meet only at the shared contract and at `/inngest/functions.ts`
(an empty array Person A appends to). See CLAUDE.md → Merge discipline.
