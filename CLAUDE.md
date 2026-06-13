@AGENTS.md

# VUS Resolver — Person B (Frontend / UI / Voice)

**VUS Resolver** takes a genetic *variant of uncertain significance* (a DNA spot a lab
flagged as "we don't know if this matters") and runs an agentic, multi-step evidence
pipeline that gathers cross-species evidence (e.g. what the same gene does when knocked
out in mice) to turn that shrug into a confidence-scored, explainable answer. The user
watches the agent reason in real time, with an optional voice interface.

This repo is split between two people. **You are Person B: everything the user sees and
talks to.** Person A owns the research engine — every part that doesn't render.

## Run & verify (pnpm, Node 20+)
- Dev:        `pnpm dev`        → http://localhost:3000  (Next.js 16 + Turbopack)
- Typecheck:  `pnpm typecheck`  (tsc --noEmit) — must be clean after every step
- Lint:       `pnpm lint`       (eslint)       — must be clean after every step
- After each step: run typecheck + lint + the step's acceptance check, update PROGRESS.md,
  then commit + push (see Git workflow).

## Stack (pinned)
Next.js 16 (App Router, TS strict, no `/src`), React 19, Tailwind **v4** (CSS-first
`@theme` in `app/globals.css` — there is NO `tailwind.config`), shadcn/ui (radix base,
`radix-nova` style), Inngest + Inngest Realtime, Vercel AI SDK **v6** + `@ai-sdk/xai`
(Grok), lucide-react, sonner, Newsreader serif (headings). Package manager **pnpm**.
shadcn CLI: use `shadcn@4.10.0` (4.11.0 `init` is broken).

## Git workflow — IMPORTANT
All work on branch **`yesh`** (tracks `origin/yesh`, remote = VinayBhagavath/Surface, the
shared repo with Person A). **Never commit or push to `main`** — main is for the final
Person A + Person B merge. Commit + push after every step.

## Merge discipline — directory ownership
**You own / may freely edit:** `/app/**`, `/components/**`, `/lib/voice/**`,
`/lib/useEvidenceRun.ts`, `/fixtures/**`, the Tailwind/shadcn theme (`app/globals.css`,
`components.json`).

**Shared — edit minimally & only as specified; flag any change `// CROSS-TEAM:`**
`/lib/types.ts`, `/lib/realtime-constants.ts`, `/inngest/client.ts`,
`/inngest/functions.ts` (empty array only), `/app/api/inngest/route.ts`.

**Never touch (Person A's) — instead stub behind the shared types with a `// PERSON A:`
note:** `/lib/connectors/**`, `/lib/grok/**`, `/lib/confidence/**`, `/lib/reference/**`,
`/inngest/evidence-pipeline.ts`, `/inngest/watcher.ts`.

## The shared contract is sacred
`/lib/types.ts` and `/lib/realtime-constants.ts` are FROZEN and must match Person A's
copies byte-for-byte. Never add/rename/reorder a field without flagging it `// CROSS-TEAM:`,
noting it in PROGRESS.md ("Blocked on / awaiting Person A"), and logging it in
`docs/DECISIONS.md`. Keep all fixtures typed against `/lib/types.ts` with **no casts** — if
a cast is tempting, the fixture is wrong, not the type.

## Three volatile integrations — CHECK CURRENT DOCS before writing; never hardcode a
remembered signature:
1. **Inngest Realtime** subscription token + client hook. NOTE: `@inngest/realtime` is
   deprecated — Realtime is now built into the `inngest` package; verify the current API.
2. **xAI / Grok voice** (speech in / speech out) via `@ai-sdk/xai`.
3. **AI SDK v6 speech / transcription** surface.
Voice is strictly optional — a missing `XAI_API_KEY` or any API error must fall back to
full text. Build everything fixture-first; the live data path is one isolated swap (Step 9).

## Confidence visual language (use everywhere a confidence appears)
gray = pending/queued · **amber = low** · **blue = moderate** · **green = high**.
Single source of truth = semantic tokens in `app/globals.css`. The **Mechanism Gate** is a
0..1 multiplier rendered as a *valve / gauge* (open ≈ evidence flows, closed ≈ suppressed),
NOT a level bar — it's the single most important visual; when low it must visibly dampen the
Cross-Species segment that follows.

## Where things are (pointers, not contents)
- Current status / what's next → **PROGRESS.md** (read this first when resuming)
- Full 10-step build plan       → **docs/plan-person-b.md**
- Architecture / data flow       → **docs/architecture-v2.md**
- Decision log                   → **docs/DECISIONS.md**
