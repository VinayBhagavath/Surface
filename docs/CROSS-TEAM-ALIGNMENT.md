# Cross-Team Alignment - Resolved

This document records the final merge alignment between Person A (`backend`) and
Person B (`yesh`).

## 1. Inngest Version Blocker - Resolved

Final choice: **Inngest v3**.

The merged repo uses:

- `inngest@^3.54.2`
- `@inngest/realtime@^0.4.7`
- `realtimeMiddleware()` in `inngest/client.ts`
- `getSubscriptionToken()` from `@inngest/realtime`
- `useInngestSubscription()` from `@inngest/realtime/hooks`

Reason: Person A's pipeline publishes through the v3 realtime middleware and was
already verified end to end. Person B's v4 direction would require porting the
backend publish path. For this hackathon merge, v3 preserves the known-good live
stream.

## 2. Shared Contract

`lib/types.ts` is Person A's authoritative version and is the only canonical
contract. The frontend reads:

- `EvidenceFragment` with stable `id` updates.
- `ConfidencePipelineState` with `mechanismGate` as a 0..1 multiplier.
- `RealtimeEvent.complete` with `briefUrl` only.
- `RunOutput` containing `{ evidenceCard, doctorBrief }`.
- `DoctorBrief.summary`, `perLayerReasons`, `overall: ConfidenceLabel`, and
  per-row `AcmgRow.caveat`.

## 3. Realtime Seam

- Trigger event: `vus.evidence.requested`
- Channel: `vus-run-${runId}`
- Topic: `events`
- Token route: `GET /api/realtime-token?runId=<runId>`
- Subscription hook: `lib/useEvidenceRun.ts`

Fragments are upserted by `data.id`; `pipeline_update` replaces the cumulative
pipeline state; `complete` reveals the brief URL.

## 4. Ownership Reconciliation

- Frontend-owned app shell, components, theme, fixtures wrappers, voice, and
  `useEvidenceRun` come from `yesh`, with live-mode integration fixes.
- Backend-owned connectors, Grok pipeline, confidence math, reference data,
  Inngest pipeline, Watcher, token route, brief API route, and store come from
  `backend`.
- `inngest/functions.ts` registers Person A's `evidencePipeline` and `watcher`.
- `package.json` is the dependency union with one Inngest major and one pnpm
  lockfile.

## 5. Runtime Expectations

The standard local verification remains:

```bash
pnpm dev
pnpm inngest
```

Then submit:

- LDLR / `rs879254403` / `hypercholesterolemia`: gate open, high confidence.
- CACNA1C / `rs776805699` / `arrhythmia`: Mechanism Gate closes and suppresses
  the cross-species layer.

On completion, `/brief/<runId>?live=1` reads the real stored `RunOutput` and
`/watch` reads the real Watcher store entries.
