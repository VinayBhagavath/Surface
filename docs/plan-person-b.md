# Build plan — Person B (Frontend / UI / Voice)

Build in order, one step at a time. After each: typecheck + lint + the acceptance check,
update PROGRESS.md, log any non-obvious choice in DECISIONS.md, then commit + push to `yesh`.
Everything is built fixture-first; the live data path and voice are wired in last.

## Step 0 — Shared contract  ✱ isolated commit
`/lib/types.ts` (FROZEN, byte-for-byte with Person A): `EvidenceFragment`,
`ConfidencePipelineState`, `RealtimeEvent`, `AcmgRow`, `DoctorBrief`.
`/lib/realtime-constants.ts`: `INNGEST_EVENT = "vus.evidence.requested"`, `runChannel(runId)`.
**Accept:** both compile, no errors. Commit alone so Person A can diff.

## Step 1 — Inngest plumbing
`/inngest/client.ts` (shared; Inngest client + realtime middleware — VERIFY current API,
@inngest/realtime is deprecated), `/inngest/functions.ts` (shared; `export const functions:
any[] = []` — Person A appends), `/app/api/inngest/route.ts` (serve GET/POST/PUT),
`/app/actions/start-run.ts` (server action → `inngest.send`).
**Accept:** app boots; `/api/inngest` returns introspection (not 500).

## Step 2 — Visual system
Clinical palette + confidence color tokens (pending/low/moderate/high) as CSS vars / Tailwind
v4 `@theme` in `app/globals.css` (single source of truth). Build
`/components/ConfidencePipelineStrip.tsx` (4 segments: Gene Prior → Variant Effect →
Mechanism Gate → Cross-Species). Render the **Mechanism Gate as a valve/gauge**, not a bar.
**Accept:** a temp page shows the strip with a gate-open and a gate-closed state, obviously
distinct at a glance.

## Step 3 — Fixtures  (dev scaffolds, not shipped mock data)
`/fixtures/kcnq1-run.ts` (everything-agrees; gate ≈ 0.95) and `/fixtures/gate-closed-run.ts`
(strong cross-species suppressed by gate ≈ 0.1; overall low/moderate). Ordered
`RealtimeEvent[]`, typed against `/lib/types.ts` with **no casts**.
**Accept:** both compile as `RealtimeEvent[]`.

## Step 4 — Run hook
`/lib/useEvidenceRun.ts` → stable shape `{ fragments, pipeline, narrations, complete,
briefUrl }` regardless of source. Signature `useEvidenceRun(runId, { source?: "fixture" |
"live", fixture? })`. Fixture mode replays events on a ~700ms timer. Live mode isolated behind
`subscribeToRun(runId, onEvent)` — stub throws "not yet wired" until Step 9.
**Accept:** throwaway page shows accumulating state advancing over time.

## Step 5 — `/` Intake
Variant input (HGVS/rsID) + small VCF-upload affordance (text is priority) + clinical-context
dropdown (confirm exact label strings with Person A): Cardiac / arrhythmia, Cardiomyopathy,
Neurodevelopmental, Immune / immunodeficiency, Metabolic, Hearing loss, Other / unsure. On
submit: `crypto.randomUUID()` → `startRun({runId, variant, clinicalContext})` → redirect to
`/session/[runId]`.
**Accept:** submit emits the Inngest event and navigates to `/session/<uuid>`.

## Step 6 — `/session/[runId]`  (the core experience)
Two panes, driven by `useEvidenceRun(runId, { source: "fixture", fixture: kcnq1Run })`; make
the fixture swappable via `?demo=gate-closed`. Header = ConfidencePipelineStrip wired to
`pipeline` (gate animates to its value; when low, dampens Cross-Species). Right pane = Evidence
Trajectory: one card per `fragment` (source, summary, inline value chip); not-yet-reached steps
render as grayed "queued" placeholders (derive from the Step-0 fragment's branch). Left pane =
Conversation: `narrations` as chat messages (fully readable with no voice). On `complete`:
"View your Doctor Brief" → `/brief/[runId]` + a "Watching this variant" confirmation.
**Accept:** `/session/anything` plays KCNQ1 fragment-by-fragment; `?demo=gate-closed` shows the
suppressed-cross-species moment clearly.

## Step 7 — `/brief/[runId]`  (Doctor Brief, printable)
Reads a `DoctorBrief` (`/fixtures/kcnq1-brief.ts` for now; freeze the shape with Person A
first). Render: plain-language summary, overall confidence + per-layer breakdown (4 layers +
gate value & reason), ACMG/AMP `<table>` (code, direction, strength, fact). `ps3Caveat`
rendered **verbatim** beneath the table; `whatWouldChangeThis` shown when confidence is low.
Print stylesheet → clean one-page PDF via browser print; share/download button.
**Accept:** `/brief/kcnq1-demo` renders clean & printable; print preview looks like a real note.

## Step 8 — `/watch`  (Watcher dashboard)
List of registered variants: variant id, last-checked timestamp, result ("checked — no change"
/ "update found — view updated brief"). Surface the re-check interval per row (credibility).
Placeholder data; both result states represented.
**Accept:** `/watch` renders the list with both states.

## Step 9 — Wire live data  (only after Person A is publishing) — CHECK CURRENT INNGEST DOCS
Server action returning a subscription token scoped to `runChannel(runId)`. Implement
`subscribeToRun` using the current client subscription hook, mapping messages → `RealtimeEvent`.
Flip `/session` hook `source: "fixture"` → `"live"` (no component changes — verify). Wire
`/brief` to Person A's real `DoctorBrief` read path.
**Accept:** a real run streams live fragments into `/session`; strip fills from real
`pipeline_update`s; gate behaves on the gate-closing variant in a joint test with Person A.

## Step 10 — Grok voice  (additive, last) — CHECK CURRENT @ai-sdk/xai + AI SDK v6 SPEECH DOCS
Output: speak each `narration` as it arrives (transcript shown in the conversation pane in
sync). Input: patient speaks → transcribed to a conversation message; optional voice intake on
`/`. Follow-ups (e.g. "why didn't the mouse data count here?") answered from current trajectory
+ pipeline state (coordinate with Person A on whether this reuses their narration prompt).
Strictly optional — missing key or API error → full text fallback.
**Accept:** voice on → KCNQ1 narrates aloud in sync; voice off/failing → everything works in text.
