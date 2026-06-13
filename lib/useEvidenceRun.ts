// /lib/useEvidenceRun.ts
// The single seam between run data and the UI. Returns the SAME shape whether the
// source is a replayed fixture (now) or the live Inngest Realtime subscription
// (Step 9), so swapping fixture → live is a one-liner with no component changes.
//
// Event semantics match Person A's pipeline (docs/CROSS-TEAM-ALIGNMENT.md §6):
//   • fragment        → UPSERT by `data.id` (a later same-id fragment is an UPDATE,
//                       e.g. IMPC relevance filled in after Step 5)
//   • pipeline_update → REPLACE the pipeline (each event carries cumulative state)
//   • narration       → append
//   • complete        → set complete + briefUrl

import * as React from "react";
import type {
  ConfidencePipelineState,
  EvidenceFragment,
  RealtimeEvent,
} from "@/lib/types";

export type EvidenceRunState = {
  fragments: EvidenceFragment[];
  pipeline: ConfidencePipelineState;
  narrations: string[];
  complete: boolean;
  briefUrl: string | null;
};

const EMPTY_PIPELINE: ConfidencePipelineState = {
  genePrior: null,
  variantEffect: null,
  mechanismGate: null,
  crossSpecies: null,
  overall: null,
};

const INITIAL_STATE: EvidenceRunState = {
  fragments: [],
  pipeline: EMPTY_PIPELINE,
  narrations: [],
  complete: false,
  briefUrl: null,
};

type Action = { kind: "reset" } | { kind: "event"; event: RealtimeEvent };

function reducer(state: EvidenceRunState, action: Action): EvidenceRunState {
  if (action.kind === "reset") return INITIAL_STATE;
  const ev = action.event;
  switch (ev.type) {
    case "fragment": {
      const idx = state.fragments.findIndex((f) => f.id === ev.data.id);
      const fragments =
        idx >= 0
          ? state.fragments.map((f, i) => (i === idx ? ev.data : f)) // upsert in place
          : [...state.fragments, ev.data];
      return { ...state, fragments };
    }
    case "narration":
      return { ...state, narrations: [...state.narrations, ev.data] };
    case "pipeline_update":
      return { ...state, pipeline: ev.data }; // replace (cumulative)
    case "complete":
      return { ...state, complete: true, briefUrl: ev.briefUrl };
    default:
      return state;
  }
}

export type UseEvidenceRunOptions = {
  source?: "fixture" | "live";
  /** Required in fixture mode. Pass a STABLE reference (e.g. DEMO_RUNS[id]). */
  fixture?: RealtimeEvent[];
  /** Fixture replay cadence in ms (default 700). */
  intervalMs?: number;
};

/**
 * Live subscription — implemented in Step 9 once Person A is publishing. Isolated
 * here so components never touch it directly; they only consume the hook's return
 * shape. Throws until wired.
 */
function subscribeToRun(
  runId: string,
  onEvent: (event: RealtimeEvent) => void,
): () => void {
  void onEvent; // wired in Step 9
  throw new Error(`subscribeToRun(${runId}): live mode not yet wired (Step 9)`);
}

export function useEvidenceRun(
  runId: string,
  opts?: UseEvidenceRunOptions,
): EvidenceRunState {
  const source = opts?.source ?? "fixture";
  const fixture = opts?.fixture;
  const intervalMs = opts?.intervalMs ?? 700;

  const [state, dispatch] = React.useReducer(reducer, INITIAL_STATE);

  React.useEffect(() => {
    dispatch({ kind: "reset" });

    if (source === "live") {
      // Components never call subscribeToRun directly — only via this hook.
      const unsubscribe = subscribeToRun(runId, (event) =>
        dispatch({ kind: "event", event }),
      );
      return unsubscribe;
    }

    // Fixture mode: replay the event stream on a timer.
    const events = fixture ?? [];
    let i = 0;
    const emitNext = () => {
      if (i >= events.length) return;
      dispatch({ kind: "event", event: events[i] });
      i += 1;
    };
    emitNext(); // first event immediately so the UI isn't blank
    const timer = setInterval(() => {
      if (i >= events.length) {
        clearInterval(timer);
        return;
      }
      emitNext();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [runId, source, fixture, intervalMs]);

  return state;
}
