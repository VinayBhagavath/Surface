# The VUS Watcher

`inngest/watcher.ts`. On pipeline completion, each run is registered (a
`WatchEntry` + a Step-6 `WatchSnapshot` in the store). The Watcher then re-runs
the **live** ClinVar (via MyVariant) + IMPC queries and diffs against the
snapshot.

## Triggers

Two, deliberately:

- **`cron: "*/2 * * * *"`** — the scheduled cadence (`WATCH_CRON` in
  `lib/pipeline/config.ts`). This is a **config value, not the logic**.
- **`event: "vus.watch.recheck"`** — on-demand, so a re-check can be forced during
  a demo (or test) without waiting for the cron: `GET /api/test-trigger?watch=1`.

## The "no mocks" framing (say this to judges)

A real ClinVar reclassification won't happen during a demo window, and faking one
would violate the hard constraint. So the cadence is shortened and pointed at the
**real, live APIs**. The overwhelmingly likely outcome on stage is the function
running, making real calls, and reporting **"checked — no change"** — which is
itself the correct demonstration: the infrastructure works, runs on schedule, and
queries real data. The "change found" branch is the *same code, same component,
same real-data path* — just the less likely outcome on any short interval. This
is materially different from "we'll simulate an update." It is the actual
production code, running on the actual production mechanism, just polling faster
than a real deployment would.

## What a re-check does

1. `listWatch()` → every registered run.
2. For each: re-run `myvariant` (ClinVar significance) + `impc` (MP terms) live.
3. Diff vs the stored snapshot: significance changed? new MP term ids?
4. **No change** → publish `narration` "checked — no change", update the entry.
5. **Change** → a short Grok narration of *what* changed → publish `narration` +
   `complete` (updated brief) → update snapshot + entry.

## Verified

Confirmed live: the function registers with both triggers, receives
`vus.watch.recheck`, initializes a run, performs the live MyVariant + IMPC
re-queries, and finishes (`inngest/function.finished`, no errors). The Inngest
dev server does not always auto-fire crons within a short observation window — the
event trigger is the reliable path for demos and tests; on Inngest Cloud the cron
fires on schedule.

## Production note

The snapshot/watchlist must persist between the pipeline run and the re-check.
In-memory works for local dev (single process). On Vercel set `KV_REST_API_URL` /
`KV_REST_API_TOKEN` (see [DEPLOY.md](DEPLOY.md)).
