// DEV harness for useEvidenceRun (Step 4 acceptance check): replays a real fixture
// and shows the accumulating state advancing over time. Not part of the product flow.
"use client";

import { useEvidenceRun } from "@/lib/useEvidenceRun";
import { DEMO_RUNS } from "@/fixtures/runs";

export default function RunHookTestPage() {
  const state = useEvidenceRun("dev-ldlr", {
    source: "fixture",
    fixture: DEMO_RUNS.ldlr,
    intervalMs: 500,
  });

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-8 font-mono text-xs">
      <h1 className="font-sans text-lg font-semibold">
        useEvidenceRun — fixture replay (ldlr)
      </h1>
      <p data-testid="counters" className="text-muted-foreground">
        fragments: {state.fragments.length} · narrations: {state.narrations.length}{" "}
        · complete: {String(state.complete)} · briefUrl: {state.briefUrl ?? "—"}
      </p>

      <section>
        <h2 className="font-sans font-medium">pipeline</h2>
        <pre className="overflow-x-auto rounded-md bg-muted p-3">
          {JSON.stringify(state.pipeline, null, 2)}
        </pre>
      </section>

      <section className="space-y-1">
        <h2 className="font-sans font-medium">fragments ({state.fragments.length})</h2>
        <ul className="space-y-1">
          {state.fragments.map((f) => (
            <li key={f.id}>
              [{f.step}] <span className="text-foreground">{f.source}</span> —{" "}
              {f.summary}
              {f.relevance ? ` · relevance=${f.relevance}` : ""}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-1">
        <h2 className="font-sans font-medium">
          narrations ({state.narrations.length})
        </h2>
        <ul className="space-y-1">
          {state.narrations.map((n, i) => (
            <li key={i}>💬 {n}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
