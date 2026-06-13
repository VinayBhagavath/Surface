# CLAUDE.md - VUS Resolver

Guidance for future agents or humans working in this merged repo.

## What This Is

VUS Resolver turns a genetic variant of uncertain significance into a live,
confidence-scored evidence review. A user enters an rsID/HGVS string or uploads a
VCF, chooses the clinical context, and watches an Inngest pipeline gather real
human and cross-species evidence before producing a Doctor Brief.

The merged app includes both halves of the hackathon project:

- Frontend: Next.js UI, intake, session stream, Doctor Brief, Watch dashboard,
  fixture dev harnesses, optional browser voice, and Grok follow-up Q&A.
- Backend: public genomics connectors, Inngest evidence pipeline, Realtime
  stream, Grok reasoning calls, layered confidence math, stored run outputs, and
  Watcher registration/re-checks.

Hard constraint: do not fabricate evidence. A real empty API result is rendered
as `found:false`; it is not replaced with fallback data. Fixture files are
captured real runs for demos/dev harnesses only. Real user submissions must use
the live pipeline.

## Stack

- Next.js 16 App Router, React 19, TypeScript strict.
- Tailwind v4 and shadcn/radix UI.
- Inngest v3 with `@inngest/realtime` middleware.
- Grok/xAI via `openai` for backend reasoning and AI SDK `@ai-sdk/xai` for
  optional follow-up Q&A.
- pnpm is the package manager. Keep one lockfile: `pnpm-lock.yaml`.

The Inngest version decision is resolved: use `inngest@^3.54.2` with
`@inngest/realtime@^0.4.7`. Person A's pipeline and Realtime middleware are
verified on v3; v4 removed/broke the middleware path this demo depends on.

## Directory Map

```text
app/
  page.tsx                         live intake
  session/[runId]/page.tsx         live or fixture session shell
  brief/[runId]/page.tsx           stored live output or captured fixture demo
  watch/page.tsx                   real Watcher store dashboard
  api/inngest/route.ts             Inngest serve endpoint
  api/realtime-token/route.ts      scoped Realtime subscription token
  api/brief/[runId]/route.ts       stored RunOutput JSON
  api/test-trigger/route.ts        backend test trigger
  dev/pipeline, dev/run            dev harnesses; keep functional
components/                        UI components and shadcn primitives
fixtures/                          captured real demo streams/outputs
inngest/                           v3 client, channels, pipeline, watcher
lib/
  types.ts                         canonical shared contract
  realtime-constants.ts            event name and channel helper
  useEvidenceRun.ts                fixture/live reducer + v3 subscription hook
  connectors/                      public genomics connectors
  confidence/                      deterministic layered confidence model
  grok/                            backend Grok prompts and schemas
  pipeline/                        orchestrator shared by Inngest/capture
  reference/                       mechanism, panel/HPO, ACMG references
  store.ts                         memory/KV run output and Watcher store
  voice/                           browser speech hooks
scripts/                           connector tests and fixture capture
docs/                              contract, decisions, deployment, handoff
```

## Running Locally

```bash
pnpm install

# terminal 1
pnpm dev

# terminal 2
pnpm inngest
```

Open `http://localhost:3000`. Normal intake submissions redirect to
`/session/<runId>?live=1` and subscribe to the real Realtime stream. The Inngest
dev server introspects `/api/inngest`.

Required env:

- `XAI_API_KEY` for Grok reasoning and follow-up Q&A.
- Optional `XAI_BASE_URL`, `XAI_MODEL`.
- Optional `KV_REST_API_URL`/`KV_REST_API_TOKEN` or Upstash equivalents for a
  durable store. Without KV, `next dev` uses an in-memory store.

## Verification Commands

```bash
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm connectors
pnpm capture ldlr
pnpm capture cacna1c
pnpm capture kcnq1
```

The full demo verification is:

1. Run `pnpm dev` and `pnpm inngest`.
2. Submit LDLR (`rs879254403`, `hypercholesterolemia`) from `/`.
3. Confirm live fragments, pipeline updates, completion, Doctor Brief, and Watch
   registration.
4. Submit CACNA1C (`rs776805699`, `arrhythmia`) and confirm the Mechanism Gate
   closes and suppresses cross-species evidence.
5. Confirm voice off leaves the app fully usable, and follow-up Q&A is grounded
   in the visible evidence when `XAI_API_KEY` is available.

## Conventions

- Read `node_modules/next/dist/docs/` before changing Next APIs; this repo uses
  a newer Next version than most older examples.
- `lib/types.ts` is authoritative. Adapt callers to it rather than forking types.
- `RealtimeEvent.complete` carries `briefUrl`, not inline brief data.
- Upsert fragments by `EvidenceFragment.id`; IMPC relevance can republish the
  same card with updated relevance.
- The Mechanism Gate is a 0..1 multiplier/valve, not a confidence bar.
- Keep `/dev/pipeline` and `/dev/run` until the final cleanup pass.
- Keep Grok prompts narrow and grounded. Do not add a mega-prompt or let Grok
  override the deterministic confidence label.
