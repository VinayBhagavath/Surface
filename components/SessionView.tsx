"use client";

// The investigation, radically simplified into one calm vertical flow:
//   1. the DNA change we found (SequenceViewer)
//   2. a short, high-level animated trace of what the agent is doing
//   3. a plain-language summary a patient can actually read
//
// The trace timing is driven by the real captured run (fixture replay through
// useEvidenceRun); the DNA view + summary come from that run's real output.

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Check, Eye, Loader2 } from "lucide-react";

import { useEvidenceRun } from "@/lib/useEvidenceRun";
import { DEMO_OUTPUTS, DEMO_RUNS, type DemoId } from "@/fixtures/runs";
import { sequenceContextFromCard } from "@/lib/sequence";
import { buildPatientSummary, type PatientSummary } from "@/lib/patient-summary";
import { summarizeForPatient } from "@/app/actions/patient-summary";
import { TRACE_STAGES, stageStatuses, type StageStatus } from "@/lib/agent-trace";
import { SequenceViewer } from "@/components/SequenceViewer";
import type { ConfidenceLabel } from "@/lib/types";
import { cn } from "@/lib/utils";

const CONF_CHIP: Record<ConfidenceLabel, string> = {
  high: "bg-confidence-high-soft text-confidence-high-ink border-confidence-high/40",
  moderate: "bg-confidence-moderate-soft text-confidence-moderate-ink border-confidence-moderate/40",
  low: "bg-confidence-low-soft text-confidence-low-ink border-confidence-low/40",
};

function StageRow({ stage, status }: { stage: (typeof TRACE_STAGES)[number]; status: StageStatus }) {
  return (
    <li className="flex items-center gap-3 py-1.5">
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors",
          status === "done" && "border-confidence-high/40 bg-confidence-high-soft text-confidence-high-ink",
          status === "active" && "border-primary/40 bg-primary/10 text-primary",
          status === "pending" && "border-border bg-muted text-muted-foreground/50",
        )}
      >
        {status === "done" ? (
          <Check className="size-3.5" />
        ) : status === "active" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <span className="size-1.5 rounded-full bg-current" />
        )}
      </span>
      <span
        className={cn(
          "text-sm transition-colors",
          status === "active" && "font-medium text-foreground",
          status === "done" && "text-foreground/80",
          status === "pending" && "text-muted-foreground/60",
        )}
      >
        {status === "active" ? `${stage.activeLabel}…` : stage.label}
      </span>
    </li>
  );
}

export function SessionView({
  runId,
  demo,
  live = false,
  variant,
  clinicalContext,
}: {
  runId: string;
  demo: DemoId;
  live?: boolean;
  variant?: string;
  clinicalContext?: string;
}) {
  const output = DEMO_OUTPUTS[demo];
  const seqCtx = React.useMemo(() => sequenceContextFromCard(output.evidenceCard), [output]);

  const { fragments, pipeline, complete } = useEvidenceRun(runId, {
    source: live ? "live" : "fixture",
    fixture: DEMO_RUNS[demo],
    intervalMs: 850,
  });

  const statuses = stageStatuses({ fragments, pipeline, complete });

  // Patient summary: written by Grok on completion (grounded in the real run
  // output), with a deterministic fallback so it always renders.
  const [summary, setSummary] = React.useState<PatientSummary | null>(null);
  const [writing, setWriting] = React.useState(false);
  const requestedRef = React.useRef(false);
  React.useEffect(() => {
    if (!complete || requestedRef.current) return;
    requestedRef.current = true;
    setWriting(true);
    summarizeForPatient({ runId, demo })
      .then((s) => setSummary(s))
      .catch(() => setSummary(buildPatientSummary(output)))
      .finally(() => setWriting(false));
  }, [complete, runId, demo, output]);

  const briefParams = new URLSearchParams({ demo });
  if (variant) briefParams.set("variant", variant);
  if (clinicalContext) briefParams.set("context", clinicalContext);
  const briefHref = `/brief/${runId}?${briefParams.toString()}`;

  return (
    <main className="min-h-screen bg-background">
      {/* minimal header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-card/80 px-4 py-2.5 backdrop-blur sm:px-6">
        <Link
          href="/"
          className="flex size-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Start over"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <span className="font-serif text-base font-semibold text-foreground">Your result</span>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          {complete ? (
            <>
              <Check className="size-3.5 text-confidence-high-ink" /> Done
            </>
          ) : (
            <>
              <Loader2 className="size-3.5 animate-spin" /> Working…
            </>
          )}
        </span>
      </header>

      <div className="mx-auto w-full max-w-2xl space-y-10 px-5 py-8 sm:py-12">
        {/* 1 — the DNA change */}
        <section className="space-y-3">
          <h2 className="font-serif text-xl font-semibold text-foreground">
            The change we found in your DNA
          </h2>
          {seqCtx ? (
            <SequenceViewer ctx={seqCtx} />
          ) : (
            <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
              This variant doesn&rsquo;t map to a single DNA letter change we can draw.
            </p>
          )}
        </section>

        {/* 2 — what the agent is doing (high level, animated) */}
        <section className="space-y-3">
          <h2 className="font-serif text-xl font-semibold text-foreground">
            What the agent is doing
          </h2>
          <ul className="rounded-xl border bg-card px-4 py-2 sm:px-5">
            {TRACE_STAGES.map((stage, i) => (
              <StageRow key={stage.id} stage={stage} status={statuses[i]} />
            ))}
          </ul>
        </section>

        {/* 3 — plain-language summary (written by Grok on completion) */}
        <section className="space-y-3">
          <h2 className="font-serif text-xl font-semibold text-foreground">What this means</h2>
          {!complete ? (
            <div className="flex items-center gap-3 rounded-xl border border-dashed bg-card/50 p-5 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Gathering the evidence — your plain-language summary will appear here.
            </div>
          ) : !summary || writing ? (
            <div className="flex items-center gap-3 rounded-xl border border-dashed bg-card/50 p-5 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Writing your summary in plain language…
            </div>
          ) : (
            <div className="seg-in space-y-4 rounded-xl border bg-card p-5">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                  CONF_CHIP[summary.confidence],
                )}
              >
                {summary.verdict}
              </span>

              <p className="text-pretty text-base font-medium leading-relaxed text-foreground">
                {summary.headline}
              </p>

              <div className="space-y-2">
                {summary.body.map((line, i) => (
                  <p key={i} className="text-pretty text-sm leading-relaxed text-foreground/80">
                    {line}
                  </p>
                ))}
                {summary.mouseLine && (
                  <p className="text-pretty text-sm leading-relaxed text-foreground/80">
                    {summary.mouseLine}
                  </p>
                )}
              </div>

              {/* the CRISPR / gene-therapy one-liner */}
              <div className="rounded-lg border-l-[3px] border-primary bg-primary/5 p-3.5">
                <p className="text-pretty text-sm leading-relaxed text-foreground/90">
                  <span className="font-medium">For your treatment plan: </span>
                  {summary.therapyNote}
                </p>
              </div>

              <div className="rounded-lg bg-muted/50 p-3.5">
                <p className="text-pretty text-sm leading-relaxed text-foreground/90">
                  <span className="font-medium">What to do next: </span>
                  {summary.nextStep}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  href={briefHref}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
                >
                  See the detailed brief <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/watch"
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Eye className="size-3.5" /> We&rsquo;ll keep watching for new evidence
                </Link>
              </div>

              <p className="pt-1 font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground/70">
                {summary.source === "grok"
                  ? "Summary written by Grok, grounded in this run's evidence"
                  : "Summary generated from this run's evidence"}
              </p>
            </div>
          )}

          {/* real research papers this is grounded in (Europe PMC) */}
          {complete && summary && summary.references.length > 0 && (
            <div className="rounded-xl border bg-card/60 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                <BookOpen className="size-4 text-muted-foreground" />
                Research this is based on
              </div>
              <ul className="space-y-2">
                {summary.references.map((r, i) => (
                  <li key={i} className="text-sm leading-snug">
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground/90 underline-offset-2 hover:text-primary hover:underline"
                      >
                        {r.title}
                      </a>
                    ) : (
                      <span className="text-foreground/90">{r.title}</span>
                    )}
                    {(r.journal || r.year) && (
                      <span className="text-muted-foreground">
                        {" "}
                        — {[r.journal, r.year].filter(Boolean).join(", ")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
