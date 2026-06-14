// /lib/useEvidenceRun.ts
// The single seam between run data and the UI. Returns the SAME shape whether the
// source is a replayed fixture or the live Inngest Realtime subscription, so
// swapping fixture -> live is a one-line caller choice with no component changes.
//
// Event semantics match Person A's pipeline (docs/CROSS-TEAM-ALIGNMENT.md §6):
//   • fragment        → UPSERT by `data.id` (a later same-id fragment is an UPDATE,
//                       e.g. IMPC relevance filled in after Step 5)
//   • pipeline_update → REPLACE the pipeline (each event carries cumulative state)
//   • narration       → append
//   • complete        → set complete + briefUrl

import * as React from "react";
import { useInngestSubscription } from "@inngest/realtime/hooks";
import type { Realtime } from "@inngest/realtime";
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
  /** Defaults to `"live"`. Pass `"fixture"` only for dev replay of captured events. */
  source?: "fixture" | "live";
  /** Required in fixture mode. Pass a STABLE reference (e.g. DEMO_RUNS[id]). */
  fixture?: RealtimeEvent[];
  /** Fixture replay cadence in ms (default 700). */
  intervalMs?: number;
};

type RunSubscriptionToken = Realtime.Subscribe.Token;
type RunRealtimeMessage = { data?: unknown };

function isRealtimeEvent(value: unknown): value is RealtimeEvent {
  return (
    value !== null &&
    typeof value === "object" &&
    "type" in value &&
    (value as { type?: unknown }).type !== undefined
  );
}

async function fetchRunToken(runId: string): Promise<RunSubscriptionToken> {
  const res = await fetch(`/api/realtime-token?runId=${encodeURIComponent(runId)}`);
  if (!res.ok) throw new Error(`realtime-token returned ${res.status}`);
  const token = (await res.json()) as RunSubscriptionToken;
  if (!token || typeof token !== "object" || !("channel" in token) || !("topics" in token)) {
    throw new Error("invalid realtime token returned");
  }
  return token;
}

export function useEvidenceRun(
  runId: string,
  opts?: UseEvidenceRunOptions,
): EvidenceRunState {
  const source = opts?.source ?? "live";
  const fixture = opts?.fixture;
  const intervalMs = opts?.intervalMs ?? 700;

  const [state, dispatch] = React.useReducer(reducer, INITIAL_STATE);
  const live = source === "live";
  const subscription = useInngestSubscription({
    refreshToken: live ? () => fetchRunToken(runId) : undefined,
    key: runId,
    enabled: live,
    bufferInterval: 0,
  });

  React.useEffect(() => {
    dispatch({ kind: "reset" });

    if (live) return;

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
  }, [runId, live, fixture, intervalMs]);

  React.useEffect(() => {
    if (!live) return;
    for (const message of subscription.freshData as RunRealtimeMessage[]) {
      if (isRealtimeEvent(message.data)) {
        dispatch({ kind: "event", event: message.data });
      }
    }
  }, [live, subscription.freshData]);

  React.useEffect(() => {
    if (live && subscription.error) {
      console.error("[useEvidenceRun] live subscription failed:", subscription.error);
    }
  }, [live, subscription.error]);

  return state;
}
