# PROGRESS — VUS Resolver (Person B)

_Read this first when resuming. Trust it over assumptions; if it conflicts with the code,
investigate before proceeding._

## Current status
**ALL 10 build steps implemented.** The full demo runs today in fixture mode (real captured Person A
data): intake → live evidence trajectory + confidence pipeline (gate valve) → printable Doctor Brief
→ watch dashboard, with optional Grok voice. Step 9 (live Realtime) is implemented **ready-to-flip**
(`?live=1`) and degrades gracefully; the live STREAM is pending the joint integration.

**Remaining = joint integration (cross-team, not solo-verifiable on `yesh`)** — see the checklist
under "Blocked on / awaiting Person A" below.

Dev server: `pnpm dev` (`INNGEST_DEV=1`) @ http://localhost:3000. `pnpm typecheck` + `pnpm lint` clean.

## Done
- [x] **Setup** — Next.js 16, deps, shadcn/ui (radix), `.env.local`, Person A dirs, typecheck script.
- [x] **Context files** — CLAUDE.md, PROGRESS.md, docs/{DECISIONS,plan-person-b,architecture-v2}.md.
- [x] **Step 0** — shared contract (FROZEN), commit `859f652`.
- [x] **Step 1** — Inngest plumbing; `/api/inngest` → 200 (dev mode), commit `05db1b2`.
- [x] **Step 2** — clinical palette + confidence tokens (`app/globals.css`), Newsreader serif,
      `components/ConfidencePipelineStrip.tsx` (Mechanism Gate = sluice valve), layout with
      TooltipProvider + Toaster, dev preview at `/dev/pipeline`, `components/CLAUDE.md` conventions.
- [x] **Step 3** — fixtures. Built typed scaffolds, then **converged to Person A's real captured
      JSON**: `fixtures/runs.ts` wraps `*-run.json` (`RealtimeEvent[]`) + `*-output.json` (`RunOutput`).
      Scenario map: ldlr=gate-open · cacna1c=gate-closed · kcnq1=low. Also **adopted Person A's
      authoritative `lib/types.ts`** (adds RunOutput/EvidenceCard/evolved DoctorBrief).
- [x] **Step 4** — `lib/useEvidenceRun.ts` (reducer: upsert fragments by id, replace pipeline on
      `pipeline_update`, accumulate narrations, set complete/briefUrl). Fixture replay verified at
      `/dev/run`. Live `subscribeToRun` stub throws until Step 9.
- [x] **Step 5** — `app/page.tsx` intake: variant input + VCF upload + clinical-context `<Select>`
      (`CLINICAL_CONTEXT_OPTIONS`) + 3 demo launchers. Submit → uuid runId → `startRun` → redirect to
      `/session/[runId]?demo=<mapped>`. Verified: action fires with correct payload, navigation works.
- [x] **Step 6** — `/session/[runId]` (server awaits params/searchParams) + `components/SessionView.tsx`:
      ConfidencePipelineStrip header, Conversation (narration bubbles + thinking dots + completion
      block w/ brief CTA + watch note), Evidence Trajectory (fragment cards w/ source icons + relevance
      chips, Mechanism-Gate marker before cross-species, queued placeholders). Enriched `DEMOS`/`DEMO_BY_ID`.
- [x] **Step 7** — `/brief/[runId]` (server, await params+?demo) + `components/BriefDocument.tsx`
      (clinical one-pager, print-optimized) + `BriefActions.tsx` (print / copy-link). Renders
      `DEMO_OUTPUTS[demo]` RunOutput. Verified ldlr (caveat + follow-up) & kcnq1 (whatWouldChangeThis + Low).
- [x] **Step 8** — `/watch` dashboard (`app/watch/page.tsx`): shadcn Table of watched variants
      (gene/variant, clinical context, re-check cadence, last-checked, result) — both states +
      "update found → brief". Session "Watching…" note links here. Placeholder data.

- [x] **Step 10** — Grok voice (additive). `lib/voice/useSpeech.ts` (browser TTS/STT, SSR-safe via
      `useSyncExternalStore`); `app/actions/ask-followup.ts` (Grok grok-3, grounded Q&A, returns a
      result object — never throws). SessionView: voice toggle (auto-speak narrations) + mic/text
      follow-up composer + Q&A thread. Verified a real grounded Grok answer; strict text fallback.
- [x] **Step 9** — live wiring (ready-to-flip). `subscribeToRun` in `useEvidenceRun`: fetch Person A's
      `GET /api/realtime-token?runId=` → inngest@4 client `subscribe` on `runChannel(runId)` topic
      "events" → map `message.data` → RealtimeEvent (dynamic-imported so fixture mode stays lean).
      `/session?live=1` flips source to live; `/brief?live=1` fetches `GET /api/brief/:runId` (fixture
      fallback). Default stays fixture. Verified solo: typecheck/lint clean; `?live` degrades gracefully
      (token 404 → caught, shell renders "resolving", no crash, no fixture replay).

## Joint integration checklist (cross-team — the only remaining work)
1. **Decide inngest v3 vs v4** (see DECISIONS pending items). v4: Person A upgrades + publishes via
   built-in `channel()/publish()`. v3: Person B pins v3, restores `realtimeMiddleware()` in client.ts,
   and adapts `subscribeToRun` to the v3 subscribe API.
2. Merge Person A's `backend` tree into `yesh` (connectors, pipeline, watcher, `/api/realtime-token`,
   `/api/brief/[runId]`); take Person A's `lib/types.ts`; register their functions in `inngest/functions.ts`.
3. `pnpm dev` + Inngest dev server → intake a real variant → confirm `/session?live=1` streams live
   fragments and the gate behaves on `cacna1c`; confirm `/brief?live=1` reads the real RunOutput.

## Known issues / TODOs
- **Tailwind v4 + Turbopack stale cache:** after adding new `@theme` tokens + their utilities,
  the compiled CSS can omit them (utilities render transparent). Fix: `rm -rf .next` + restart
  `pnpm dev`. (Bit us once in Step 2; resolved.) See `components/CLAUDE.md`.
- **inngest v4 vs spec's v3 pattern** — client uses `new Inngest({ id })`, NO `realtimeMiddleware`.
- Local dev requires `INNGEST_DEV=1` (baked into the `dev` script).
- shadcn CLI: use **`shadcn@4.10.0`** (`--base radix`) for future `add`.
- AI SDK is **v6** — verify voice/speech API at Step 10.
- `/dev/pipeline` is a dev-only component gallery (safe to keep or delete before ship).

## Blocked on / awaiting Person A
- [ ] **inngest major version (v3 vs v4)** — Person A is on **v3 + realtimeMiddleware** today
      (verified on `backend`). Person B is on v4. **Must pick one before merge** — see
      `docs/CROSS-TEAM-ALIGNMENT.md` §1.
- [x] **`/lib/realtime-constants.ts`** — matches Person A byte-for-byte.
- [ ] **`/lib/types.ts`** — core stream types align; Person A has extra output types
      (`EvidenceCard`, `RunOutput`, fuller `DoctorBrief`). **Use Person A's file at merge.**
- [x] **Real `RealtimeEvent[]` fixtures** — Person A's JSON now in `/fixtures/*-run.json`
      (ldlr / cacna1c / kcnq1). `cacna1c` = gate-closed scenario. See `fixtures/README.md`.
- [x] **Brief read path** — `GET /api/brief/:runId` → `{ evidenceCard, doctorBrief }` on
      `backend` (Person A adds route at merge; build `/brief` against `*-output.json` now).
- [x] **`pipeline_update` after gate** — Person A publishes after Step 3 (gate set, overall
      null) and again at end. Joint test with `cacna1c` at Step 9.
- [x] **Clinical-context keys** — use `lib/clinical-context-options.ts` (mirrors Person A's
      `panel-to-hpo.json` labels). Send the `value` key as `clinicalContext`.

## Last commit
Step 10 `6350565`. Step 9 committing now (final build step). Branch `yesh`. Run `git log --oneline -16`.
