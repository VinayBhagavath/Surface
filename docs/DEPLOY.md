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

## 3. Inngest Cloud

1. Create an Inngest app; copy the Event Key + Signing Key into Vercel.
2. Deploy to Vercel. Inngest auto-discovers functions at
   `https://<your-app>.vercel.app/api/inngest` (sync via the Inngest dashboard or
   the deploy hook).
3. The cron Watcher (`*/2 * * * *`) runs on Inngest Cloud's scheduler. Lengthen
   `WATCH_CRON` in `lib/pipeline/config.ts` for a realistic production cadence
   (e.g. daily) — it's a one-line config change.

## 4. Realtime

Inngest Realtime works the same on Cloud. The frontend fetches a token from
`/api/realtime-token?runId=…` and subscribes — no extra infra.

## Sponsor surfaces (for judging)

- **xAI / Grok** — four narrow, auditable reasoning calls per run (predictor
  leadership, mechanism gate, cross-species sanity check, synthesis) + narration;
  model `grok-4.3` via the OpenAI-compatible API.
- **Inngest** — durable seven-source pipeline with fan-out, Realtime live
  progress, and the scheduled Watcher.
- **Vercel** — hosts the app + serverless functions + (recommended) Vercel KV.
