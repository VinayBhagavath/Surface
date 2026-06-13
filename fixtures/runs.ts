// /fixtures/runs.ts
// Typed wrappers over Person A's REAL captured fixtures (fixtures/*-run.json,
// *-output.json). These are real pipeline outputs — same shape as live Inngest
// Realtime events and `/api/brief` responses — NOT hand-authored mocks. At
// integration the run hook swaps from these to the live subscription (Step 9).
//
// JSON imports are validated into our contract types here (one contained `as`
// per file, the pattern fixtures/README.md endorses) so the rest of the app
// stays fully typed.
import type { RealtimeEvent, RunOutput } from "@/lib/types";

import ldlrRunJson from "./ldlr-run.json";
import cacna1cRunJson from "./cacna1c-run.json";
import kcnq1RunJson from "./kcnq1-run.json";
import ldlrOutputJson from "./ldlr-output.json";
import cacna1cOutputJson from "./cacna1c-output.json";
import kcnq1OutputJson from "./kcnq1-output.json";

const asEvents = (j: unknown): RealtimeEvent[] => j as RealtimeEvent[];
const asOutput = (j: unknown): RunOutput => j as RunOutput;

export type DemoId = "ldlr" | "cacna1c" | "kcnq1";

export type DemoMeta = {
  id: DemoId;
  gene: string;
  variant: string;
  clinicalContext: string;
  scenario: string;
  tone: "high" | "low" | "pending"; // confidence accent for the dot
  blurb: string;
};

/** Selectable demo runs, in the order we want to offer them. */
export const DEMOS: DemoMeta[] = [
  {
    id: "ldlr",
    gene: "LDLR",
    variant: "rs879254403",
    clinicalContext: "hypercholesterolemia",
    scenario: "Gate open — everything agrees",
    tone: "high",
    blurb: "Cross-species evidence flows through. Overall HIGH.",
  },
  {
    id: "cacna1c",
    gene: "CACNA1C",
    variant: "rs776805699",
    clinicalContext: "arrhythmia",
    scenario: "Gate closed — mouse signal suppressed",
    tone: "low",
    blurb: "Mechanism gate closes (~0.10); a strong mouse signal is correctly suppressed.",
  },
  {
    id: "kcnq1",
    gene: "KCNQ1",
    variant: "rs2133727494",
    clinicalContext: "long_qt",
    scenario: "Low — predictor disagreement",
    tone: "pending",
    blurb: "Predictor disagreement and weak mouse evidence; stays uncertain.",
  },
];

export const DEMO_BY_ID: Record<DemoId, DemoMeta> = {
  ldlr: DEMOS[0],
  cacna1c: DEMOS[1],
  kcnq1: DEMOS[2],
};

export const DEMO_RUNS: Record<DemoId, RealtimeEvent[]> = {
  ldlr: asEvents(ldlrRunJson),
  cacna1c: asEvents(cacna1cRunJson),
  kcnq1: asEvents(kcnq1RunJson),
};

export const DEMO_OUTPUTS: Record<DemoId, RunOutput> = {
  ldlr: asOutput(ldlrOutputJson),
  cacna1c: asOutput(cacna1cOutputJson),
  kcnq1: asOutput(kcnq1OutputJson),
};

/** Default demo used by /session when no ?demo= is supplied. */
export const DEFAULT_DEMO: DemoId = "ldlr";

export function isDemoId(v: string | null | undefined): v is DemoId {
  return v === "ldlr" || v === "cacna1c" || v === "kcnq1";
}
