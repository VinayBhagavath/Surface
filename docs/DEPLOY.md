# Deploy (Vercel + Inngest Cloud)

The app is a standard Next.js 14 build (`npm run build` passes). Genomics
connectors run inside Inngest steps (Node runtime).

## 1. Environment variables

| var | where | notes |
|---|---|---|
| `XAI_API_KEY` | Vercel (all envs) | **required** — Grok reasoning + narration |
| `XAI_MODEL` | optional | defaults `grok-4.3` |
| `XAI_BASE_URL` | optional | defaults `https://api.x.ai/v1` |
| `INNGEST_EVENT_KEY` | Vercel | from Inngest Cloud (production) |
| `INNGEST_SIGNING_KEY` | Vercel | from Inngest Cloud (production) |
| `KV_REST_API_URL` + `KV_REST_API_TOKEN` | Vercel | **required for prod** — see below |

Locally, leave the Inngest keys blank and set `INNGEST_DEV=1` to use the dev
server.

## 2. The store MUST be KV in production

`lib/store.ts` defaults to an in-process `Map`, which is fine for `next dev`
(single process) but **will not work on Vercel**, where the Inngest function and
the `/api/brief` route are separate serverless invocations. Add **Vercel KV**
(Upstash Redis) and set `KV_REST_API_URL` / `KV_REST_API_TOKEN` — the store
auto-switches to the REST backend when those are present (no code change). This
also makes the Watcher's snapshot diffing durable.

## 3. Inngest Cloud — what you must configure (answer: yes, a little)

Locally, nothing is needed (the `dev` script sets `INNGEST_DEV=1` and the
`inngest-cli dev` server auto-discovers the app). **For Vercel you must do three
things — it will NOT work as-is without them:**

1. Create an app at [app.inngest.com](https://app.inngest.com) and copy its
   **Event Key** → `INNGEST_EVENT_KEY` and **Signing Key** → `INNGEST_SIGNING_KEY`
   into Vercel env vars (Production + Preview). Do **not** set `INNGEST_DEV` in prod.
2. Deploy to Vercel, then in the Inngest dashboard **sync** the app URL
   `https://<your-app>.vercel.app/api/inngest` (or add the Vercel integration so
   each deploy auto-syncs). After sync, Inngest shows 2 functions
   (`evidence-pipeline`, `vus-watcher`).
3. Add **Vercel KV / Upstash** (`KV_REST_API_URL` + `KV_REST_API_TOKEN`) — see §2.
   Without it the brief read path + Watcher snapshots break across serverless
   invocations.

Why: on Vercel the serve route runs in cloud mode and rejects unsigned requests
without the signing key; `inngest.send()` needs the event key to publish; and
Realtime tokens are minted server-side off the same client. With those env vars
set and the app synced, the live pipeline, Realtime streaming, and the Watcher
cron all run on Inngest Cloud with no code changes.

The cron Watcher (`*/2 * * * *`) runs on Inngest Cloud's scheduler. Lengthen
`WATCH_CRON` in `lib/pipeline/config.ts` for a realistic production cadence
(e.g. daily) — it's a one-line config change.

> Verified locally on `main`: `inngest-cli dev` synced both functions, a fired
> `vus.evidence.requested` ran the full pipeline (live genomics DBs + Grok +
> literature) to a stored brief.

## 4. Realtime

Inngest Realtime works the same on Cloud. The frontend fetches a token from
`/api/realtime-token?runId=…` and subscribes — no extra infra.

## Sponsor surfaces (for judging)

- **xAI / Grok** — narrow, auditable reasoning calls per run (predictor
  leadership, mechanism gate, cross-species sanity check, synthesis) + the
  patient-facing plain-language summary (with the CRISPR/gene-therapy note),
  grounded in real evidence; model `grok-4.3` via the OpenAI-compatible API.
- **Evidence sources** — genomic databases (Ensembl VEP, gnomAD, MyVariant/
  dbNSFP, IMPC mouse-knockout, Monarch) PLUS a real scholarly-literature pass
  (Europe PMC) so the engine and the patient summary cite actual published
  research. All keyless, public, no mocks.
- **Inngest** — durable seven-source pipeline with fan-out, Realtime live
  progress, and the scheduled Watcher.
- **Vercel** — hosts the app + serverless functions + (recommended) Vercel KV.
