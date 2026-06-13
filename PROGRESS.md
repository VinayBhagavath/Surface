# PROGRESS — VUS Resolver (Person B)

_Read this first when resuming. Trust it over assumptions; if it conflicts with the code,
investigate before proceeding._

## Current status
Step 1 (Inngest plumbing) complete — `/api/inngest` → HTTP 200 introspection (`mode:"dev"`).
**Next: Step 2 — Visual system** (clinical palette + confidence tokens + ConfidencePipelineStrip
with the Mechanism Gate as a valve). Building fixture-first; live data (Step 9) + voice (Step 10) last.

Dev server runs clean (`INNGEST_DEV=1 next dev` @ http://localhost:3000). `pnpm typecheck` +
`pnpm lint` clean.

## Done
- [x] **Setup** — Next.js 16 scaffold, runtime deps, shadcn/ui (radix), `.env.local`, Person A
      boundary dirs, `typecheck` script. Dev boots → `GET / 200`.
- [x] **Context files** — CLAUDE.md, PROGRESS.md, docs/{DECISIONS,plan-person-b,architecture-v2}.md.
- [x] **Step 0** — shared contract `/lib/types.ts` + `/lib/realtime-constants.ts` (FROZEN), commit `859f652`.
- [x] **Step 1** — Inngest plumbing: `/inngest/client.ts` (v4, no middleware — see CROSS-TEAM),
      `/inngest/functions.ts` (empty array), `/app/api/inngest/route.ts` (serve), `/app/actions/start-run.ts`.
      `dev` script now `INNGEST_DEV=1 next dev`. `/api/inngest` → 200.

## Next (immediate)
Step 2 — define confidence color tokens (pending/low/moderate/high) in `app/globals.css`
(Tailwind v4 `@theme`); build `/components/ConfidencePipelineStrip.tsx` with the Mechanism Gate
as a valve/gauge. Accept: temp page shows gate-open vs gate-closed obviously distinct.

## Known issues / TODOs
- **inngest v4 vs spec's v3 pattern** — client uses `new Inngest({ id })`, NO `realtimeMiddleware`
  (the spec's v3 import is incompatible with installed inngest@4.5.1). See DECISIONS + below.
- Local dev requires Inngest **dev mode** → baked into `dev` script as `INNGEST_DEV=1`.
- shadcn CLI: use **`shadcn@4.10.0`** (`--base radix`) for future `add`; 4.11.0 `init` is broken.
- pnpm sharp/protobufjs/unrs-resolver set to NOT build via `allowBuilds` — fine for dev.
- AI SDK is **v6** — verify voice/speech/transcription API at Step 10.

## Blocked on / awaiting Person A
- [ ] **inngest major version (v3 vs v4)** — confirm Person A is on v4 + publishes via built-in
      `channel()/publish()`; else we pin v3 together and restore `realtimeMiddleware` in client.ts.
- [ ] Confirm `/lib/types.ts` + `/lib/realtime-constants.ts` match their copies byte-for-byte.
- [ ] `DoctorBrief` shape — PROPOSE & freeze together before building `/brief` (Step 7).
- [ ] A captured real `RealtimeEvent[]` to replace the KCNQ1 fixture (drop-in, same shape).
- [ ] The real `DoctorBrief` for KCNQ1 + the brief read path (KV read vs Inngest invoke by runId).
- [ ] Confirm pipeline publishes `pipeline_update` after the Step 3 gate; joint gate-closing test.
- [ ] Confirm exact clinical-context label strings (UI labels → HPO mapping on their side).

## Last commit
`859f652` (Step 0). Step 1 + this update committing now on branch `yesh`. Run `git log --oneline -6`.
