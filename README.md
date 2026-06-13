# VUS Resolver — Research Engine

Autonomous cross-species evidence gathering for **variants of uncertain
significance (VUS)**. Given a flagged variant, the engine queries live public
genomics APIs (Ensembl, gnomAD, MyVariant/dbNSFP, IMPC, Monarch), reasons over
the results with **Grok (xAI)** at each decision point, computes a layered
confidence score, and streams the whole investigation live to the UI — then
registers a Watcher that re-checks the variant on a schedule.

This repository is the **backend half** (Person A): connectors, the Inngest
durable pipeline, the confidence model, all Grok reasoning, and the Watcher.
The frontend (Person B) builds on the contract in `lib/types.ts`.

**Branch:** backend work lives on **`backend`**. See [`docs/MERGE.md`](docs/MERGE.md)
for how Person B merges UI on top without conflicts.

> **No mocks.** Every evidence box is a real API call or a Grok call grounded in
> real API results. An empty real result is `found: false`, never fabricated.

## Quickstart

```bash
npm install
cp .env.example .env.local        # then set XAI_API_KEY (get one at console.x.ai)

# terminal 1
npm run dev                       # Next.js → http://localhost:3000
# terminal 2
npm run inngest                   # Inngest dev server → http://localhost:8288

# fire a demo run (no UI required)
curl "http://localhost:3000/api/test-trigger?demo=ldlr"
curl "http://localhost:3000/api/brief/<runId-from-above>"
```

## Scripts

| command | what |
|---|---|
| `npm run dev` | Next.js app (serves `/api/inngest`) |
| `npm run inngest` | Inngest dev server, pointed at the app |
| `npm run connectors` | live test all 7 connectors for the 3 demo variants |
| `npm run capture [id]` | run the full pipeline locally (live APIs + Grok), write `fixtures/` |
| `npm test` | confidence-model unit tests (vitest) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | production build |

## Demo variants

`ldlr` (→ HIGH, everything agrees) · `cacna1c` (→ mechanism gate closes, mouse
evidence suppressed) · `kcnq1` (→ LOW, predictors disagree + no mouse data).
Details in [`docs/DEMO_VARIANTS.md`](docs/DEMO_VARIANTS.md).

## Docs

- [`CLAUDE.md`](CLAUDE.md) — architecture + conventions (start here)
- [`docs/CONTRACT.md`](docs/CONTRACT.md) — the integration seam with Person B
- [`docs/HANDOFF.md`](docs/HANDOFF.md) — what Person B needs
- [`docs/WATCHER.md`](docs/WATCHER.md) — the Watcher's "no mocks" framing
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — Vercel + Inngest Cloud + KV
- [`docs/DEVIATIONS.md`](docs/DEVIATIONS.md) — where reality differed from the spec
