// DEV preview harness for the ConfidencePipelineStrip (Step 2 acceptance check).
// Not part of the product flow; safe to keep as a component gallery.
import { ConfidencePipelineStrip } from "@/components/ConfidencePipelineStrip";
import type { ConfidencePipelineState } from "@/lib/types";

const allHigh: ConfidencePipelineState = {
  genePrior: {
    value: 0.9,
    label: "high",
    reason: "KCNQ1 is strongly loss-of-function intolerant (low LOEUF, high pLI).",
  },
  variantEffect: {
    value: 0.88,
    label: "high",
    reason: "AlphaMissense likely-pathogenic (~0.90) at a highly conserved residue.",
  },
  mechanismGate: {
    value: 0.95,
    reason:
      "Predicted loss-of-function, so the mouse knockout is a fair comparison — evidence flows through.",
  },
  crossSpecies: {
    value: 0.85,
    label: "high",
    reason:
      "Clean 1:1 mouse ortholog; Kcnq1 knockout shows a cardiac-conduction phenotype that maps to long-QT.",
  },
  overall: { label: "high", reason: "All layers agree and the mechanism matches." },
};

const gateClosed: ConfidencePipelineState = {
  genePrior: {
    value: 0.85,
    label: "high",
    reason: "Gene is constrained, but causes disease by gain-of-function.",
  },
  variantEffect: {
    value: 0.7,
    label: "moderate",
    reason: "Missense with mixed in-silico support.",
  },
  mechanismGate: {
    value: 0.1,
    reason:
      "Gene causes disease by gain-of-function; a knockout can't speak to that mechanism — the gate closes.",
  },
  crossSpecies: {
    value: 0.9,
    label: "high",
    reason:
      "Dramatic mouse knockout phenotype — but mechanistically irrelevant to a gain-of-function variant.",
  },
  overall: {
    label: "low",
    reason:
      "The strong cross-species signal was correctly suppressed by a closed mechanism gate.",
  },
};

const midRun: ConfidencePipelineState = {
  genePrior: {
    value: 0.9,
    label: "high",
    reason: "Gene is loss-of-function intolerant.",
  },
  variantEffect: null,
  mechanismGate: null,
  crossSpecies: null,
  overall: null,
};

function Case({
  title,
  subtitle,
  pipeline,
}: {
  title: string;
  subtitle: string;
  pipeline: ConfidencePipelineState;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-serif text-xl font-medium text-foreground">{title}</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <ConfidencePipelineStrip pipeline={pipeline} />
    </section>
  );
}

export default function PipelinePreviewPage() {
  return (
    <main className="surface-grid min-h-screen px-6 py-12 sm:px-10">
      <div className="mx-auto max-w-5xl space-y-12">
        <header className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            dev · component preview
          </p>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
            Confidence Pipeline Strip
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Gene Prior → Variant Effect →{" "}
            <span className="font-medium text-foreground">Mechanism Gate (valve)</span>{" "}
            → Cross-Species. The gate is a 0–1 multiplier: when it closes, it chokes
            the flow and visibly suppresses the Cross-Species evidence downstream.
            Hover any segment for the reason.
          </p>
        </header>

        <Case
          title="Gate open — everything agrees"
          subtitle="KCNQ1-like: a predicted loss-of-function matches the knockout, so cross-species evidence flows through. Overall: high."
          pipeline={allHigh}
        />
        <Case
          title="Gate closed — cross-species suppressed"
          subtitle="Gain-of-function gene: a knockout can't speak to the mechanism, so the dramatic mouse signal is correctly damped. Overall: low."
          pipeline={gateClosed}
        />
        <Case
          title="Mid-run — layers still resolving"
          subtitle="Downstream layers render as queued placeholders until the agent reaches them."
          pipeline={midRun}
        />
      </div>
    </main>
  );
}
