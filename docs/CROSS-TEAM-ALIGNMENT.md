# Cross-team alignment (Person A ↔ Person B)

Reviewed **2026-06-13** against `backend` (Person A, complete) and `yesh`
(Person B, Steps 0–2 done). Person B is mid-build — this doc is the merge
checklist, not a blocker for continuing UI work fixture-first.

## Branch state

| branch | owner | status |
|---|---|---|
| `backend` | Person A | Research engine complete: 7 connectors, pipeline, Grok, Watcher, API routes, JSON fixtures |
| `yesh` | Person B | Steps 0–2 done: contract, Inngest plumbing, ConfidencePipelineStrip + dev preview |

**No git merge base** between branches (independent roots). Final merge = combine
trees manually or merge `backend` into `yesh` and resolve shared files.

---

## What already matches ✅

| item | Person A (`backend`) | Person B (`yesh`) |
|---|---|---|
| Event name | `vus.evidence.requested` | `INNGEST_EVENT` constant — same |
| Channel | `vus-run-${runId}`, topic `events` | `runChannel(runId)` — same string |
| `EvidenceFragment` | id, source (7 values), step 0–6, found, summary, raw, relevance? | **aligned** |
| `ConfidencePipelineState` | 4 layers + overall; gate is 0..1 multiplier | **aligned** |
| `RealtimeEvent` | fragment / narration / pipeline_update / complete{briefUrl} | **aligned** |
| Mechanism Gate UX | Documented as valve, not bar | `ConfidencePipelineStrip` implements valve correctly |
| `startRun` payload | `{ runId, variant, clinicalContext }` | `app/actions/start-run.ts` — same |

Person A's captured fixtures (`fixtures/*-run.json`, `*-output.json`) are now
copied onto `yesh` — use these for Steps 3–7 instead of hand-written scaffolds.
`cacna1c-run.json` = the gate-closed demo Person B planned as `gate-closed-run.ts`.

---

## Must resolve at merge ⚠️

### 1. Inngest major version (highest priority)

| | Person A | Person B |
|---|---|---|
| Package | `inngest@^3.54.2` + `@inngest/realtime@^0.4.6` | `inngest@^4.5.1` |
| Client | `realtimeMiddleware()` from `@inngest/realtime/middleware` | `new Inngest({ id })` only — no middleware |
| Publish | `publish(vusRunChannel(runId).events(ev))` via middleware | (expects v4 built-in `channel()/publish()`) |
| Subscribe | `getSubscriptionToken` from `@inngest/realtime` | (plans v4 `inngest/realtime` at Step 9) |

**Recommendation for hackathon merge:** pick **one** path:

- **Option A (less Person A churn):** Person B pins **inngest v3** + restores
  `realtimeMiddleware()` in shared `inngest/client.ts` to match Person A exactly.
- **Option B (Person B's current direction):** Person A upgrades to **inngest v4**
  and drops standalone `@inngest/realtime` middleware.

Person A's pipeline is verified on **v3** today. Do not merge until this is agreed.

### 2. `lib/types.ts` — shared contract drift

Person B's file is **partial** vs Person A's authoritative contract:

| type / field | Person A (`backend`) | Person B (`yesh`) | action |
|---|---|---|---|
| `ConfidenceLabel` alias | exported | missing | add at merge (Person A wins) |
| `EvidenceSource` alias | exported | inlined in fragment | cosmetic; Person A wins |
| `EvidenceRequestedData` | exported | missing | add at merge |
| `EvidenceCard` | full shape | **missing** | Person B needs for `/brief` context |
| `RunOutput` | `{ evidenceCard, doctorBrief }` | **missing** | `/api/brief` returns this |
| `AcmgRow.caveat?` | per-row PS3 caveat | **missing** | Person B planned top-level `ps3Caveat` instead |
| `DoctorBrief.overall` | `ConfidenceLabel` string | `{ label, reason }` object | **Person A wins** |
| `DoctorBrief.summary` | field name | Person B uses `plainSummary` | **Person A wins** |
| `DoctorBrief.perLayerReasons` | field name | Person B uses `layers` | **Person A wins** |
| `DoctorBrief.geneSymbol` | present | **missing** | add at merge |
| `DoctorBrief.suggestedFollowUp` | present | **missing** | add at merge |
| `DoctorBrief.generatedAt` | present | **missing** | add at merge |
| `DoctorBrief.whatWouldChangeThis` | `string \| null` | optional `string` | align nullability |

**Recommendation:** at merge, **`lib/types.ts` = Person A's version** (from
`backend`). Person B adapts `/brief` Step 7 to `summary`, `perLayerReasons`,
`overall: ConfidenceLabel`, `AcmgRow.caveat?`, etc. Person A's fixtures in
`fixtures/*-output.json` are the ground truth for UI development.

### 3. Next.js version

| | Person A | Person B |
|---|---|---|
| Next | 14.2 | 16.2 |
| React | 18 | 19 |
| Tailwind | none (minimal CSS) | v4 + shadcn |

Person B owns the app scaffold — **keep Next 16 + Tailwind on merge**. Person A
only adds backend modules; they are framework-agnostic. Person B must use **async
`params`** in App Router (Next 15+).

### 4. Shared Inngest files at merge

| file | merge rule |
|---|---|
| `inngest/client.ts` | Agree v3 vs v4 first, then one combined client with EventSchemas |
| `inngest/functions.ts` | Person A's `[evidencePipeline, watcher]` — replace empty array |
| `app/api/inngest/route.ts` | Identical — no conflict expected |

Person A adds (Person B does **not** duplicate):

- `inngest/evidence-pipeline.ts`, `inngest/watcher.ts`, `inngest/channels.ts`
- `app/api/realtime-token/route.ts`, `app/api/brief/[runId]/route.ts`
- all of `lib/connectors/`, `lib/grok/`, `lib/confidence/`, `lib/pipeline/`, `lib/store.ts`

### 5. Clinical context intake (Step 5)

Dropdown **`value`** must be Person A's `panel-to-hpo.json` **keys**, not free text.
Person B's plan listed slightly different label groupings — use
`lib/clinical-context-options.ts` (added on `yesh`) which mirrors Person A's
`_meta.labels` exactly.

Demo variants Person A uses internally:

| id | variant | clinicalContext key |
|---|---|---|
| `ldlr` | rs879254403 | `hypercholesterolemia` |
| `cacna1c` | rs776805699 | `arrhythmia` |
| `kcnq1` | rs2133727494 | `long_qt` |

### 6. Live data wiring (Person B Step 9)

Person A already exposes:

```
GET /api/realtime-token?runId=…   → Inngest subscription token
GET /api/brief/:runId             → RunOutput JSON (404 until complete)
```

Person B's `useEvidenceRun` live path should:

1. Fetch token from `/api/realtime-token?runId=…`
2. Subscribe to `runChannel(runId)` topic `events`
3. Upsert fragments by **`data.id`** (same id = update, especially IMPC relevance)
4. Replace `pipeline` on each `pipeline_update` (fires after gate + at end)
5. Set `briefUrl` on `complete` — **not** inline brief payload

Voice (Step 10): still **not implemented anywhere** — text `narration` events only.

---

## Person B review — bugs / gaps found (Steps 0–2)

| severity | item | notes |
|---|---|---|
| ✅ none | `ConfidencePipelineStrip` | Typecheck + build clean; gate-open vs gate-closed visually distinct |
| ✅ none | `start-run.ts` | Correct event emission |
| ⚠️ doc | `PROGRESS.md` "Last commit" | Was stale (said Step 1 while Step 2 landed) — fixed |
| ⚠️ merge | `@inngest/realtime` in package.json | Unused on v4 client; pulls nested inngest v3 — remove when pinning version |
| ℹ️ WIP | `app/page.tsx` | Still Next.js template — Step 5 replaces it (expected) |
| ℹ️ WIP | No `useEvidenceRun`, session, brief routes | Steps 4–7 (expected) |
| ℹ️ WIP | No voice | Step 10 (expected) |

---

## Recommended merge order

1. Agree **Inngest v3 vs v4** (see §1).
2. Merge **`lib/types.ts` from Person A** into `yesh`.
3. Merge Person A backend tree (`lib/connectors` … `inngest/watcher`, API routes).
4. Person B keeps all `app/` UI, `components/`, `useEvidenceRun`, theme.
5. Combined `inngest/functions.ts` registers Person A's functions.
6. Joint test: `pnpm dev` + Inngest dev → intake → `/session` live stream → `/brief`.

See also Person A's `docs/MERGE.md` on the `backend` branch.
