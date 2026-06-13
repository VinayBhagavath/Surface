# VUS Resolver — Build Plan: App, UI & Voice (Person B)

You own everything the user sees and talks to — the Next.js app, all routes
and components, the live Evidence Trajectory UI, and the Grok voice
integration. Your teammate owns the connectors, the Inngest pipeline, and the
Grok reasoning calls. The seam between you is small and defined below first —
agree on it together before splitting off.

## The Shared Contract (do this together, ~30 min, before splitting)

This is identical to your teammate's copy — make sure you're both looking at
the same file. Create `/lib/types.ts` together:

```ts
export type EvidenceFragment = {
  id: string;
  source: "ensembl_vep" | "gnomad_constraint" | "myvariant" | "ensembl_conservation"
        | "ensembl_diopt" | "impc" | "monarch_phenodigm";
  step: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  queryTime: string;
  found: boolean;
  summary: string;             // this is what renders directly in the card
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
  | { type: "narration"; data: string }
  | { type: "pipeline_update"; data: ConfidencePipelineState }
  | { type: "complete"; briefUrl: string };
```

Also agree on:

- **Inngest event name**: `vus.evidence.requested`, payload `{ runId, variant: string, clinicalContext: string }` — this is what your intake form's Server Action emits.
- **Realtime channel name**: `vus-run-${runId}`.
- **`DoctorBrief` type** — agree on the shape with your teammate before you build `/brief/[runId]`: ACMG rows as `{ code: string; direction: "pathogenic" | "benign"; strength: string; fact: string }[]`, plus the overall rating, per-layer reasons, and the "what would change this" line.

Once pinned, you can build almost everything below against a **fixture file**
your teammate gives you (a captured real run's `RealtimeEvent[]` in order) —
this means you don't need their pipeline finished to build the UI. Swapping
the fixture for the live Realtime subscription at the end should require zero
component changes, since the shape is identical.

## What You're Building

### 1. App scaffold

Next.js 14, App Router, TypeScript, Tailwind + shadcn/ui. Set up the calm,
clinical visual language early (muted blues/greens, generous whitespace,
confidence-level color coding: gray = pending, amber = low, blue = moderate,
green = high) — this is a small upfront decision that every component depends
on, so lock it in before building components.

### 2. Routes & Components — `/app`

- **`/` — Intake.** Form: HGVS/rsID input (or small VCF upload + pick a
  flagged variant), and a clinical-context picker (the panel-type dropdown
  that maps to HPO terms on your teammate's side — you just need the list of
  option labels from them, e.g. cardiomyopathy / immune / neurodevelopmental).
  On submit, a Server Action emits `vus.evidence.requested` and redirects to
  `/session/[runId]`.

- **`/session/[runId]` — The core experience.** Two-pane layout:
  - **Left pane — Conversation.** Grok voice/text interface (see §3). Also
    renders `narration` events from the Realtime stream as chat-style
    messages, with text-to-speech if voice is active.
  - **Right pane — Evidence Trajectory.** This is your main build target.
    A vertical list of cards, one per `EvidenceFragment`, populated in order
    from the Realtime subscription (or fixture during dev). Each card: source
    icon/name, `summary` text, and a small inline value chip if applicable
    (e.g. "AlphaMissense: likely pathogenic (0.87)"). Steps not yet reached
    render as grayed "queued" placeholders — derive the initial queued list
    from the Step 0 router's first fragment (it tells you which branch you're
    on, so you know which later steps to show as queued).
  - **Confidence Pipeline strip** — persistent header above the right pane.
    Four segments (Gene Prior, Variant Effect, Mechanism Gate, Cross-Species)
    that fill in from `pipeline_update` events. Render the Mechanism Gate
    segment visually distinctly (a "valve"/gauge style, not a bar) since it's
    a multiplier — this is the single highest-value visual in the whole app,
    spend real design time here.

- **`/brief/[runId]` — Doctor Brief.** Clean, printable page (add a print
  stylesheet for PDF export — no extra service needed): plain-language
  summary, confidence rating with per-layer breakdown, the ACMG/AMP table
  (render the `DoctorBrief.acmgRows` as an actual table, including the PS3-
  framing caveat text verbatim where present), and the "what would change
  this" line when confidence is low. Add a share/download button.

- **`/watch` — Watcher dashboard.** List of registered variants: each row
  shows variant id, last-checked timestamp, and result ("checked, no change"
  / "update found — view updated brief"). Also surface the configured check
  interval somewhere visible — per the architecture, showing the real cron
  schedule is part of the credibility story, not a detail to hide.

### 3. Realtime subscription hook — `/lib/useEvidenceRun.ts`

A hook `useEvidenceRun(runId)` that subscribes to the `vus-run-${runId}`
Inngest Realtime channel and returns `{ fragments, pipeline, narrations,
complete, briefUrl }`, updating as `RealtimeEvent`s arrive. Build this against
the fixture file first — literally replay the fixture array on a timer to
simulate streaming — then swap the fixture-replay for the real subscription
call once your teammate's pipeline is publishing. This swap should be a
one-line change if the hook's return shape is stable, which is the whole point
of nailing the shared types first.

### 4. Grok voice integration

Bidirectional voice via the Grok voice API (xAI), in `/session/[runId]`:

- **Input**: patient speaks, gets transcribed, becomes a message in the
  conversation pane (and can also be the *initial* input on `/` if you want
  voice-driven intake — nice-to-have, build text intake first).
- **Output**: `narration` events from the Realtime stream are spoken aloud as
  they arrive, with the transcript shown simultaneously in the conversation
  pane so the Evidence Trajectory and the spoken narration stay visually in
  sync.
- **Follow-up Q&A**: the patient can interrupt/ask follow-ups ("why didn't the
  mouse data count for much here?") — these go to Grok with the current
  trajectory + pipeline state as context (your teammate's narration prompt
  template is reusable here, or you can make a lightweight separate "answer a
  follow-up given this context" call — coordinate on whether this lives in
  your code or theirs; either is fine, just pick one).

## Suggested Order

1. Shared contract (together).
2. App scaffold + visual language (colors, spacing, the four-segment
   Confidence Pipeline strip as a static component with hardcoded values) —
   you can do this with zero backend dependency.
3. `/` intake form + Server Action emitting the Inngest event (can be built
   and tested even before the pipeline function exists — Inngest will just
   queue the event).
4. `useEvidenceRun` hook against a fixture (request this from your teammate
   as soon as their Step 0–2 work lands).
5. Evidence Trajectory cards + queued-state logic, driven by the fixture
   replay.
6. `/brief/[runId]` against a real example `DoctorBrief` (request from
   teammate by mid-point).
7. `/watch` dashboard — can be built with placeholder data until the Watcher
   exists, since its shape is simple.
8. Voice integration last — it's additive on top of the text conversation
   pane, and the rest of the app should work without it as a fallback
   interaction mode.

## What to Request From Your Teammate, and When

- **Immediately**: the shared types file.
- **As soon as possible**: a captured real `RealtimeEvent[]` fixture for one
  full run of the KCNQ1 demo variant (this unblocks almost everything in §2–5).
- **By mid-point**: the `DoctorBrief` type + one real example for KCNQ1.
- **Before final integration**: confirm the Realtime channel naming and that
  their pipeline is actually publishing `pipeline_update` after Step 3 (the
  gate) — this is the event your Confidence Pipeline strip's "valve" segment
  depends on, and it's worth a quick joint test with the second demo variant
  (the gate-closing one) to make sure the UI correctly shows a suppressed
  cross-species contribution.
