# CLAUDE.md - VUS Resolver

Guidance for future agents or humans working in this merged repo.

## What This Is

VUS Resolver turns a genetic variant of uncertain significance into a live,
confidence-scored evidence review. A user uploads a VCF; every variant is
annotated to its gene + consequence (Ensembl VEP) and the user picks one to
investigate; an Inngest pipeline then gathers real human and cross-species
evidence, gates it by mechanism, and produces a plain-language summary + Doctor
Brief.

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
- Grok/xAI through ONE client: the `openai` SDK pointed at `api.x.ai/v1`
  (`lib/grok/client.ts`). The chat path runs the lighter calls; the Responses
  API runs reasoning mode (mechanism gate + synthesis) and Live Search
  (`web_search`) for out-of-table gene mechanism. One model only: `grok-4.3`
  via `XAI_MODEL`. (The old `@ai-sdk/xai` / `grok-3` follow-up path was removed —
  follow-up Q&A uses the same client.)
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

- `XAI_API_KEY` for Grok reasoning, Live Search, and follow-up Q&A.
- Optional `XAI_BASE_URL`, `XAI_MODEL` (defaults `grok-4.3`), and
  `XAI_WEB_SEARCH` (set `0` to disable Live Search; on by default).
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
2. Upload `public/samples/patient_PT001_raw.vcf` from `/`; confirm all 12
   variants annotate to their genes, then pick TP53 and confirm the Mechanism
   Gate CLOSES (GoF) and suppresses the mouse lethality signal. Pick MSH6/ATM and
   confirm the gate OPENS (LoF). (BRCA1/MLH1 in this file are already classified
   in ClinVar, so they correctly early-exit — they are not VUS.)
3. Confirm live fragments, pipeline updates, completion, the plain-language
   summary, Doctor Brief, and Watch registration.
4. Or use the "see a finished example" demos (LDLR gate-open/HIGH, CACNA1C
   gate-closes, KCNQ1 low) — these replay captured runs.
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
- One xAI client/config/model only (`lib/grok/client.ts` + `getXaiConfig`,
  `grok-4.3`). Reasoning is Responses-API only (effort `medium` for the gate,
  `low` for synthesis); reasoning calls must not send presence/frequency_penalty
  or stop. The schema-validated wrapper contract is identical regardless of which
  transport (chat vs responses) ran — callers don't change.
- Live Search (`web_search`) is scoped to ONLY genes absent from the curated
  mechanism table, is cited + labeled, and is additive: `XAI_WEB_SEARCH=0` or an
  empty/failed search must still leave a working run (the gate stays cautious).
- NO deterministic/local fallbacks and NO demo reliability. Every Grok reasoning
  call is live; transient failures are absorbed by the Inngest step retries, and a
  persistent failure fails the run honestly rather than substituting deterministic
  output. (The old `lib/grok/fallbacks.ts` and the captured demo fixtures were
  removed.) Reference *tables* (ACMG criteria, the curated ClinGen/OMIM
  gene-mechanism table, HPO maps) are scientific constants, not fallbacks — and
  out-of-table genes are researched live via Grok Live Search.
- Intake is upload-only and fully live: `app/page.tsx` parses a VCF in the browser
  (`lib/vcf.ts`), annotates every variant via live VEP (`app/actions/annotate-vcf.ts`
  — only parsed coordinates leave the browser, nothing is stored), the user picks
  one, and `/session/[runId]` streams the real Inngest Realtime run (DNA decode
  intro animation → live agent trace → Grok-written summary). No fixtures.
