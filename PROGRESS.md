# PROGRESS — VUS Resolver (Person B)

_Read this first when resuming. Trust it over assumptions; if it conflicts with the code,
investigate before proceeding._

## Current status
Step 2 (visual system + ConfidencePipelineStrip valve) complete and **visually verified**
(gate-open vs gate-closed obviously distinct; Mechanism Gate renders as a sluice valve).
**Next: Step 3 — the fixtures** (`fixtures/kcnq1-run.ts`, `fixtures/gate-closed-run.ts`).

Dev server: `pnpm dev` (`INNGEST_DEV=1`) @ http://localhost:3000. `pnpm typecheck` + `pnpm lint` clean.

## Done
- [x] **Setup** — Next.js 16, deps, shadcn/ui (radix), `.env.local`, Person A dirs, typecheck script.
- [x] **Context files** — CLAUDE.md, PROGRESS.md, docs/{DECISIONS,plan-person-b,architecture-v2}.md.
- [x] **Step 0** — shared contract (FROZEN), commit `859f652`.
- [x] **Step 1** — Inngest plumbing; `/api/inngest` → 200 (dev mode), commit `05db1b2`.
- [x] **Step 2** — clinical palette + confidence tokens (`app/globals.css`), Newsreader serif,
      `components/ConfidencePipelineStrip.tsx` (Mechanism Gate = sluice valve), layout with
      TooltipProvider + Toaster, dev preview at `/dev/pipeline`, `components/CLAUDE.md` conventions.

## Next (immediate)
Step 3 — author two ordered `RealtimeEvent[]` fixtures typed against `/lib/types.ts` (NO casts):
`kcnq1-run.ts` (everything agrees, gate ≈ 0.95) and `gate-closed-run.ts` (strong cross-species
suppressed by gate ≈ 0.1, overall low/moderate). Mark clearly as dev scaffolds.

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
- [ ] **inngest major version (v3 vs v4)** — confirm v4 + publish via built-in `channel()/publish()`.
- [ ] Confirm `/lib/types.ts` + `/lib/realtime-constants.ts` match their copies byte-for-byte.
- [ ] `DoctorBrief` shape — PROPOSE & freeze together before building `/brief` (Step 7).
- [ ] A captured real `RealtimeEvent[]` to replace the KCNQ1 fixture (drop-in, same shape).
- [ ] The real `DoctorBrief` for KCNQ1 + the brief read path.
- [ ] Confirm pipeline publishes `pipeline_update` after the Step 3 gate; joint gate-closing test.
- [ ] Confirm exact clinical-context label strings (UI labels → HPO mapping on their side).

## Last commit
`05db1b2` (Step 1). Step 2 committing now on branch `yesh`. Run `git log --oneline -8`.
