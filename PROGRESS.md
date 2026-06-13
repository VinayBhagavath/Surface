# PROGRESS — VUS Resolver (Person B)

_Read this first when resuming. Trust it over assumptions; if it conflicts with the code,
investigate before proceeding._

## Current status
Step 7 (`/brief/[runId]`) complete and **verified** — clinical one-pager from Person A's real
`*-output.json`: letterhead, overall badge, 4-layer breakdown (gate ×value), ACMG/AMP `<table>`,
**verbatim per-row caveats** (ldlr †), `whatWouldChangeThis` (kcnq1) + `suggestedFollowUp`, print
stylesheet (chrome hidden, doc flattened) + copy-link/print buttons.
**Next: Step 8 — `/watch` dashboard.**

NOTE: user added a real `XAI_API_KEY` to `.env.local` (gitignored) → voice (Step 10) can run live.

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

## Next (immediate)
Step 8 — `app/watch/page.tsx`: Watcher dashboard. List of registered variants (variant id,
last-checked timestamp, result: "checked — no change" / "update found — view updated brief"). Surface
the re-check interval per row (the cron cadence is part of the credibility story). Placeholder data;
both result states represented.

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
Step 6 `e44d450`. Step 7 committing now. Branch `yesh`. Run `git log --oneline -10`.
