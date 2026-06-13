# Merge guide (Person A backend ↔ Person B frontend)

This repo is a **shared monorepo**. Person A owns the research engine on the
`backend` branch; Person B builds UI/voice on `main` (or a `frontend` branch).
Integration happens through fixed seams — not by editing each other's files.

## Branch layout

| branch | owner | scope |
|---|---|---|
| `backend` | Person A | `lib/connectors/`, `lib/pipeline/`, `lib/grok/`, `lib/confidence/`, `inngest/`, `scripts/`, `fixtures/`, `docs/` (backend), placeholder `app/page.tsx` |
| `main` / `frontend` | Person B | `app/` routes (`/`, `/session`, `/brief`, `/watch`), components, hooks, voice |

**Do not change** [`lib/types.ts`](../lib/types.ts) on either side without
coordinating — it is the contract. See [`docs/CONTRACT.md`](CONTRACT.md).

## Safe merge order

1. Person A merges `backend` → `main` first (or Person B rebases onto `backend`).
   The backend half is self-contained under `lib/` + `inngest/` + API routes.
2. Person B adds UI **without** renaming or moving:
   - `GET /api/realtime-token?runId=…`
   - `GET /api/brief/[runId]`
   - `POST` intake → `inngest.send({ name: "vus.evidence.requested", … })`
3. Replace `app/page.tsx` with the real intake page; keep the API routes as-is.

## Files Person B should not touch

- `lib/connectors/**`, `lib/pipeline/**`, `lib/grok/**`, `lib/confidence/**`
- `inngest/**`
- `scripts/**`, `fixtures/**` (read-only for UI dev)

## Files Person A should not touch (after handoff)

- Person B's route components under `app/session/`, `app/brief/`, etc.
- Voice/hook code

## Conflict hotspots (resolve by keeping both sides)

- `package.json` — merge dependencies (Person B may add UI libs; Person A adds
  none beyond Inngest/Grok).
- `app/layout.tsx` — Person B adds fonts/theme; Person A only added metadata +
  `globals.css`.
- `README.md` — combine quickstart sections from both halves.

## Verify after merge

```bash
npm run typecheck && npm test && npm run build
npm run dev          # terminal 1
npm run inngest      # terminal 2
curl "http://localhost:3000/api/test-trigger?demo=ldlr"
```

Person B: replay `fixtures/ldlr-run.json` in the hook, then swap to live
subscription — shapes must match [`docs/CONTRACT.md`](CONTRACT.md).
