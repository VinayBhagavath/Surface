# Fixtures

## Real captured runs (from Person A / `backend` branch)

These JSON files are **real** pipeline outputs — not mocks. Same shape as live
Inngest Realtime events and `/api/brief` responses.

| file | path exercised |
|---|---|
| `ldlr-run.json` | HIGH — everything agrees, gate open |
| `cacna1c-run.json` | Mechanism gate closes (~0.10), cross-species suppressed |
| `kcnq1-run.json` | LOW — predictor disagreement, weak mouse evidence |
| `*-output.json` | `{ evidenceCard, doctorBrief }` for `/brief` |

Use them in Step 3+ instead of hand-authoring scaffolds when possible:

```ts
import ldlrRun from "@/fixtures/ldlr-run.json";
import type { RealtimeEvent } from "@/lib/types";

const events = ldlrRun as RealtimeEvent[]; // OK for JSON import; prefer `satisfies` once typed wrapper exists
```

Person B's Step 3 plan also mentions `gate-closed-run.ts` — **`cacna1c-run.json` is
that scenario** (use `?demo=cacna1c` or fixture id `cacna1c`).
