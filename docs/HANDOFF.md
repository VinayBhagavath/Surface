# Handoff to Person B

Everything you need to build the UI/voice half. The contract is in
[`docs/CONTRACT.md`](CONTRACT.md); this is the practical checklist.

## You already have

1. **Shared types** — `lib/types.ts` (don't edit shapes without flagging me).
2. **Fixtures** — `fixtures/{ldlr,cacna1c,kcnq1}-run.json` (RealtimeEvent[]) and
   `-output.json` (DoctorBrief/EvidenceCard). Build the Evidence Trajectory,
   Confidence Pipeline strip, and `/brief` against these before my pipeline is
   even running. Swapping fixture-replay → live subscription is a one-line change.
3. **Live endpoints** (run `npm run dev` + `npm run inngest`):
   - `GET /api/realtime-token?runId=…` → subscription token for your hook.
   - `GET /api/brief/${runId}` → the completed output.
   - `GET|POST /api/test-trigger?demo=ldlr` → fire a run for manual testing.

## Building `useEvidenceRun(runId)`

```ts
import { useInngestSubscription } from "@inngest/realtime/hooks";
// fetch the token from /api/realtime-token?runId=runId, then:
const { data } = useInngestSubscription({ refreshToken: () => fetch(...).then(r => r.json()) });
// each `data` item is a RealtimeEvent. Reduce them:
//   fragment       → upsert into a Map keyed by data.id (later = update)
//   narration      → push to the conversation pane (speak if voice on)
//   pipeline_update → replace the Confidence Pipeline strip state
//   complete       → reveal "View Doctor Brief" → /brief/${runId}
```

Return `{ fragments, pipeline, narrations, complete, briefUrl }`.

## Things to coordinate / verify together

1. **Channel name** is `vus-run-${runId}`, topic `events` — already wired in the
   token route.
2. **`pipeline_update` fires after the gate (Step 3)** with `mechanismGate` set but
   `overall: null`, and again at the end with `overall` set. The Mechanism Gate
   segment is a multiplier (valve/gauge), not a bar — render it distinctly. Test
   with `demo=cacna1c`: you should see `crossSpecies` visibly suppressed (~0.07)
   while gate ≈ 0.10. This is the money shot.
3. **Same-`id` fragment = update.** The IMPC fragments arrive first as
   `relevance:"unscored"`, then get re-published with `high/medium/low` after
   Step 5. Treat the second as an update to the same card.
4. **Demo variants for both paths**: `ldlr` exercises the HIGH/everything-agrees
   path; `kcnq1` exercises the LOW path (disagreement + no mouse data); `cacna1c`
   exercises the gate-closing path. Use `kcnq1` + `cacna1c` to verify your
   low/moderate rendering, not just the best case.

## Intake dropdown options

Use the `labels` map in `lib/reference/panel-to-hpo.json` for the clinical-context
picker (value = the key, e.g. `hypercholesterolemia`; label = the human text).

## Voice follow-ups

`lib/grok/narration.ts` exports `answerFollowUp({ question, geneSymbol,
clinicalContext, contextSummary })` — reuse it for the "why didn't the mouse data
count?" Q&A, grounded in the trajectory you already have client-side.
