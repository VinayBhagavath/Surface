# PROGRESS — VUS Resolver (Person B)

_Read this first when resuming. Trust it over assumptions; if it conflicts with the code,
investigate before proceeding._

## Current status
Setup + persistent context files complete. **Next: Step 0 — the shared contract
(`/lib/types.ts`, `/lib/realtime-constants.ts`).** Building fixture-first; the live data
path (Step 9) and voice (Step 10) come last.

Dev server runs clean (Next 16 + Turbopack @ http://localhost:3000). `pnpm typecheck` and
`pnpm lint` both clean.

## Done
- [x] **Setup** — Next.js 16 App Router scaffold (TS strict, Tailwind v4, ESLint 9, no
      `/src`); runtime deps (inngest, @inngest/realtime, ai v6, @ai-sdk/xai); shadcn/ui
      (radix) components button/card/badge/input/select/separator/table/tooltip/skeleton/
      sonner; `.env.local` placeholders; Person A boundary dirs; `typecheck` script. Dev
      boots → `GET / 200`.
- [x] **Context files** — CLAUDE.md, PROGRESS.md, docs/DECISIONS.md, docs/plan-person-b.md,
      docs/architecture-v2.md.

## Next (immediate)
Step 0 — create `/lib/types.ts` exactly per spec (EvidenceFragment, ConfidencePipelineState,
RealtimeEvent, AcmgRow, DoctorBrief) + `/lib/realtime-constants.ts`. Commit as an isolated
"shared contract" commit Person A can diff.

## Known issues / TODOs
- `@inngest/realtime@0.4.7` is **deprecated** — Realtime is now built into the `inngest`
  package. The spec's Step 1 `client.ts` imports `realtimeMiddleware` from `@inngest/realtime`;
  verify the CURRENT API before writing `/inngest/client.ts` (shared → `// CROSS-TEAM:` if it
  differs from spec).
- shadcn CLI 4.11.0 `init` is buggy (defaults to Base UI, self-adds `shadcn`, aborts). Pinned
  to **4.10.0** + `--base radix`. Use `shadcn@4.10.0` for any future `add`.
- pnpm build scripts (sharp / protobufjs / unrs-resolver) set to NOT build via `allowBuilds`
  in `pnpm-workspace.yaml` — fine for this app (no sharp/image-opt needed at dev time).
- AI SDK is **v6** (not v5) — verify voice/speech/transcription API shape at Step 10.

## Blocked on / awaiting Person A
- [ ] Confirm `/lib/types.ts` + `/lib/realtime-constants.ts` match their copies byte-for-byte.
- [ ] `DoctorBrief` shape — PROPOSE & freeze together before building `/brief` (Step 7).
- [ ] A captured real `RealtimeEvent[]` to replace the KCNQ1 fixture (drop-in, same shape).
- [ ] The real `DoctorBrief` for KCNQ1 + the brief read path (KV read vs Inngest invoke by runId).
- [ ] Confirm their pipeline publishes `pipeline_update` after the Step 3 gate; joint test on
      the gate-closing variant.
- [ ] Confirm the exact clinical-context label strings (UI labels → HPO mapping on their side).

## Last commit
`40b4943` — chore: scaffold Next.js 16 App Router + shadcn/ui + Inngest/AI SDK deps
(branch `yesh`, pushed to `origin/yesh`). _Context-files commit follows._
