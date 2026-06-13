# VUS Resolver

Full-stack hackathon app for resolving variants of uncertain significance with
live public genomics evidence, Grok reasoning, a layered confidence model, and a
printable Doctor Brief.

The normal user path is live: intake emits `vus.evidence.requested`, the Inngest
pipeline gathers real evidence, Realtime streams fragments into `/session`, and
completion writes the `RunOutput` consumed by `/brief` and `/watch`.

## Quickstart

```bash
pnpm install
pnpm dev
pnpm inngest
```

Open `http://localhost:3000`.

Set `XAI_API_KEY` in `.env.local` for Grok reasoning. Without it, the app should
fail honestly instead of fabricating results; voice follow-up remains optional.

## Main Scripts

| command | purpose |
| --- | --- |
| `pnpm dev` | Next.js app with `INNGEST_DEV=1` |
| `pnpm inngest` | Inngest dev server pointed at `/api/inngest` |
| `pnpm build` | production build |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | confidence-model unit tests |
| `pnpm connectors` | live connector smoke tests |
| `pnpm capture <id>` | run the real pipeline locally and write fixtures |

## Demo Variants

- `ldlr`: `rs879254403`, hypercholesterolemia, gate open, high confidence.
- `cacna1c`: `rs776805699`, arrhythmia, Mechanism Gate closes.
- `kcnq1`: `rs2133727494`, long QT, low confidence/uncertainty preserved.

See `CLAUDE.md`, `docs/CONTRACT.md`, `docs/DEMO_VARIANTS.md`, and
`docs/DECISIONS.md` for the integration contract and rationale.
