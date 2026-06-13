# PROGRESS — VUS Resolver (Person B)

_Read this first when resuming. Trust it over assumptions; if it conflicts with the code,
investigate before proceeding._

## Current status
Step 3 (fixtures) complete — my typed `kcnq1Run` (gate open) + `gateClosedRun` (gate closed)
compile as `RealtimeEvent[]` (no casts). **Person A has ALSO pushed REAL captured fixtures** to
`/fixtures/*-run.json` (kcnq1 / cacna1c / ldlr; `cacna1c` = gate-closed) + outputs `*-output.json`.
**Next: Step 4 — the `useEvidenceRun` hook**, which should replay Person A's real JSON (adapt to
`RealtimeEvent`). See `docs/CROSS-TEAM-ALIGNMENT.md`.

Dev server: `pnpm dev` (`INNGEST_DEV=1`) @ http://localhost:3000. `pnpm typecheck` + `pnpm lint` clean.

## Done
- [x] **Setup** — Next.js 16, deps, shadcn/ui (radix), `.env.local`, Person A dirs, typecheck script.
- [x] **Context files** — CLAUDE.md, PROGRESS.md, docs/{DECISIONS,plan-person-b,architecture-v2}.md.
- [x] **Step 0** — shared contract (FROZEN), commit `859f652`.
- [x] **Step 1** — Inngest plumbing; `/api/inngest` → 200 (dev mode), commit `05db1b2`.
- [x] **Step 2** — clinical palette + confidence tokens (`app/globals.css`), Newsreader serif,
      `components/ConfidencePipelineStrip.tsx` (Mechanism Gate = sluice valve), layout with
      TooltipProvider + Toaster, dev preview at `/dev/pipeline`, `components/CLAUDE.md` conventions.
- [x] **Step 3** — fixtures `fixtures/kcnq1-run.ts` (`kcnq1Run`, gate ≈ 0.95) + `fixtures/gate-closed-run.ts`
      (`gateClosedRun`, SCN8A gain-of-function, gate ≈ 0.10, strong cross-species suppressed).
      Ordered `RealtimeEvent[]`, no casts. pipeline_update events carry CUMULATIVE state.

## Next (immediate)
Step 4 — `lib/useEvidenceRun.ts`: stable return `{ fragments, pipeline, narrations, complete,
briefUrl }`. Fixture mode replays a `RealtimeEvent[]` on a ~700ms timer; merge each pipeline_update
field-by-field (non-null wins); accumulate fragments + narrations; set complete/briefUrl on the
`complete` event. Live mode = stub `subscribeToRun(runId, onEvent)` that throws "not yet wired"
(Step 9). Throwaway test page logs the accumulating state advancing over time.

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
Rebased onto Person A's `2e36237` (cross-team alignment + real fixtures). Step 3 (`e0b74b7`,
typed fixtures) replayed on top. Branch `yesh`. Run `git log --oneline -10`.
