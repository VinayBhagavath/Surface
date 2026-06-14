# VUS Resolver

Turn a genetic **variant of uncertain significance** into a live,
confidence-scored evidence review — in plain language a patient can follow, and
in a printable Doctor Brief a clinician can act on.

A user uploads their sequencing file (VCF). Every variant is annotated to its
gene + consequence with live Ensembl VEP; the user picks the one to investigate.
A durable Inngest pipeline then gathers **real** human and cross-species evidence
from public genomics APIs, gates it by disease mechanism, scores it with a
deterministic layered-confidence model, and lets Grok write the final
plain-language summary and Doctor Brief. As it works, the agent narrates each
step — and can **speak those thoughts aloud in the Grok voice**.

> **Hard rule: nothing is faked.** There are no demo replays, no canned audio,
> and no deterministic/local fallbacks in the live path. A genuinely empty API
> result renders as `found: false` — it is never swapped for stand-in data. If a
> live model call can't complete, the run fails honestly. Reference *tables*
> (ACMG criteria, the curated gene→mechanism table, HPO maps) are scientific
> constants, not fallbacks; genes missing from the table are researched live via
> Grok Live Search.

---

## The experience (one clean, live flow)

1. **Upload** (`/`) — the VCF is parsed **in the browser** (`lib/vcf.ts`); only
   parsed variant coordinates leave the page, and nothing is stored. Every
   variant is annotated via live VEP (`app/actions/annotate-vcf.ts`).
2. **Pick a variant + clinical context**, then "Investigate this variant" fires
   the real pipeline (`app/actions/start-run.ts` → Inngest) and routes to the
   session.
3. **Decode animation** (`components/SequenceDecodeAnimation.tsx`) plays the
   instant the session opens — a sequence "scan" that resolves onto the **real**
   substitution from the live VEP fragment. It starts immediately (no flash of a
   half-built result) and only hands off to the result view once the real change
   has streamed in.
4. **Live session** (`/session/[runId]`, `components/SessionView.tsx`):
   - **The change we found** — the DNA-level substitution (`SequenceViewer`).
   - **What the agent is thinking** — the agent's live, Grok-written narration as
     a thought trail, plus a high-level checklist of the steps it is running.
     Toggle **"Hear it think"** to have the Grok voice read each thought aloud as
     it happens; tap the speaker on any line to replay it.
   - **What this means** — a plain-language summary written live by Grok on
     completion, grounded in the run's real evidence + real literature, with a
     CRISPR/gene-therapy one-liner and the papers it's based on.
5. **Doctor Brief** (`/brief/[runId]`) — the printable, ACMG-framed brief built
   from the stored `RunOutput`.
6. **Watch** (`/watch`) — every completed run is registered with the Watcher,
   which re-checks the evidence on a schedule and flags changes.

Everything on the session page is driven by the per-run Inngest **Realtime**
stream and the run's real stored output.

---

## The agent thinking voice (Grok TTS)

The pipeline already emits first-person `narration` events at each step
("I'm checking what's known in mice now"). The UI surfaces these as the thought
trail and can speak them:

- `app/api/tts/route.ts` — server proxy to **xAI Text-to-Speech**
  (`POST /v1/tts`, model `grok-voice-think-fast-1.1`). The API key never reaches
  the browser. It strips citations/URLs so lines read cleanly, then returns MP3.
- `lib/voice/useAgentVoice.ts` — a queued player: each new narration is spoken in
  order so thoughts never overlap. It is **additive and fails silent** — no key,
  an upstream error, or a blocked autoplay just leaves the layer quiet; the
  on-screen trail and the rest of the run are unaffected. No audio is pre-recorded.

Voice/model/speed are configurable (`XAI_TTS_VOICE`, `XAI_TTS_MODEL`,
`XAI_TTS_SPEED`). See the [xAI Voice docs](https://docs.x.ai/developers/model-capabilities/audio/voice).

---

## The research pipeline (`lib/pipeline/run-evidence-pipeline.ts`)

One orchestrator, abstracted over `runStep` + `publish`, so the same code runs as
the durable Inngest function and emits the live Realtime events:

| Step | What happens | Source |
| --- | --- | --- |
| 0 | Variant → gene + consequence (router) | Ensembl VEP |
| 1 | Gene constraint (LOEUF / pLI / mis-z) | gnomAD |
| 2 | ClinVar status, gnomAD freq, dbNSFP predictors, conservation | MyVariant + Ensembl |
| — | **Early exit** if already classified in ClinVar or too common | — |
| 2-Grok | Predictor leadership + disagreement read | Grok reasoning |
| 3-Grok | **Mechanism-Compatibility Gate** (0..1 valve) | Grok reasoning (+ Live Search for out-of-table genes) |
| 4 | Cross-species fan-out: ortholog → mouse-KO phenotype → MP↔HPO | DIOPT, IMPC, Monarch |
| 5-Grok | Cross-species sanity check + relevance scoring | Grok reasoning |
| 5b | Scholarly literature pass | Europe PMC |
| 6 | Layered confidence + synthesis (summary, ACMG rows, brief) | deterministic model + Grok |

The **Mechanism Gate** is the key idea: a multiplier in `[0,1]`, not a confidence
bar. A loss-of-function variant in a LoF-intolerant gene opens the gate so the
mouse-knockout signal counts; a gain-of-function condition closes it and
suppresses an otherwise dramatic (e.g. embryonic-lethal) cross-species signal.
Confidence math is deterministic (`lib/confidence/layered-model.ts`); Grok never
overrides the computed label.

---

## Stack

- **Next.js 16** App Router, **React 19**, TypeScript strict. (This is a newer
  Next than most examples — read `node_modules/next/dist/docs/` before changing
  Next APIs.)
- **Tailwind v4** + shadcn/radix UI.
- **Inngest v3** (`inngest@^3.54.2`) with `@inngest/realtime@^0.4.7` middleware
  for the durable pipeline and the per-run Realtime stream.
- **Grok / xAI** through ONE client: the `openai` SDK pointed at `api.x.ai/v1`
  (`lib/grok/client.ts`). One model for reasoning (`grok-4.3` via `XAI_MODEL`):
  chat for light calls, the Responses API for reasoning mode + Live Search. The
  agent voice uses xAI TTS (`grok-voice-think-fast-1.1`).
- **pnpm** is the package manager (single `pnpm-lock.yaml`).

---

## Running locally

```bash
pnpm install

# terminal 1 — Next.js (INNGEST_DEV=1)
pnpm dev

# terminal 2 — Inngest dev server, introspecting /api/inngest
pnpm inngest
```

Open `http://localhost:3000`. Set `XAI_API_KEY` in `.env.local` (see
`.env.example`). Without it the app fails honestly instead of fabricating
results; the voice layer simply stays silent. Without KV, dev uses an in-memory
store.

---

## Scripts

| command | purpose |
| --- | --- |
| `pnpm dev` | Next.js app with `INNGEST_DEV=1` |
| `pnpm inngest` | Inngest dev server pointed at `/api/inngest` |
| `pnpm build` | production build |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint (incl. React Compiler hook rules) |
| `pnpm test` | confidence-model + VCF unit tests (Vitest) |
| `pnpm connectors` | live public-connector smoke tests |
| `pnpm capture <id>` | run the real pipeline locally (dev/debug tooling) |

Backend test trigger (no UI): `GET /api/test-trigger?variant=rs879254403&context=hypercholesterolemia`.

---

## Directory map

```text
app/
  page.tsx                     live VCF intake (browser parse + live VEP)
  session/[runId]/page.tsx     live session shell → SessionView
  brief/[runId]/page.tsx       printable Doctor Brief from stored RunOutput
  watch/page.tsx               Watcher dashboard
  actions/                     start-run, annotate-vcf, patient-summary
  api/inngest/route.ts         Inngest serve endpoint
  api/realtime-token/route.ts  scoped Realtime subscription token
  api/brief/[runId]/route.ts   stored RunOutput JSON
  api/tts/route.ts             agent-voice proxy (xAI TTS)
components/
  SessionView.tsx              live session (change, thinking + voice, summary)
  SequenceDecodeAnimation.tsx  intro decode animation (upload → result)
  SequenceViewer.tsx           DNA-level substitution view
  BriefDocument.tsx            Doctor Brief
inngest/                       v3 client, channels, pipeline fn, watcher
lib/
  types.ts                     canonical shared contract
  pipeline/                    the evidence-pipeline orchestrator
  connectors/                  public genomics connectors (all keyless)
  confidence/                  deterministic layered confidence model
  grok/                        Grok prompts, schemas, reasoning calls
  reference/                   ACMG, gene→mechanism table, panel/HPO maps
  voice/useAgentVoice.ts       queued Grok-voice playback (fails silent)
  useEvidenceRun.ts            live Realtime reducer/subscription hook
  agent-trace.ts               friendly step checklist mapping
  sequence.ts                  VEP fragment → render-ready DNA context
  store.ts                     KV / in-memory run + Watcher store
```

See `CLAUDE.md`, `docs/CONTRACT.md`, and `docs/DECISIONS.md` for the integration
contract and the rationale behind each decision.
