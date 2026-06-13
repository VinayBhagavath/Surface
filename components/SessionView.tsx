"use client";

// The investigation, in one calm vertical flow:
//   1. the DNA change we found (SequenceViewer)
//   2. a short, high-level animated trace of what the agent is doing
//   3. a plain-language summary a patient can actually read
//   4. an optional follow-up Q&A (Grok, grounded in this run; voice optional)
//
// Two modes from the SAME components:
//   • live  (real upload)  → data comes from the live Inngest Realtime stream and
//     the run's real stored output; the DNA view is built from the live VEP
//     fragment and the summary from the saved RunOutput.
//   • demo  (worked example) → the trace replays a real captured run and the DNA
//     view / summary come from that run's captured output.

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Check, Eye, Loader2, Mic, Send, Volume2, VolumeX } from "lucide-react";

import { useEvidenceRun } from "@/lib/useEvidenceRun";
import { DEMO_OUTPUTS, DEMO_RUNS, type DemoId } from "@/fixtures/runs";
import { sequenceContextFromCard, parseSequenceContext } from "@/lib/sequence";
import { buildPatientSummary, type PatientSummary } from "@/lib/patient-summary";
import { summarizeForPatient } from "@/app/actions/patient-summary";
import { askFollowup, type FollowupContext } from "@/app/actions/ask-followup";
import { useSpeech } from "@/lib/voice/useSpeech";
import { TRACE_STAGES, stageStatuses, type StageStatus } from "@/lib/agent-trace";
import { SequenceViewer } from "@/components/SequenceViewer";
import { Input } from "@/components/ui/input";
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

function minimalSummary(label: ConfidenceLabel): PatientSummary {
  return {
    confidence: label,
    verdict: label === "high" ? "Likely important" : label === "moderate" ? "Possibly important" : "Still unclear",
    headline: "We finished the investigation, but couldn't write the plain-language summary just now.",
    body: ["You can open the detailed brief to see the full evidence behind this result."],
    mouseLine: null,
    therapyNote: "Discuss this result with your care team before any treatment decision is made.",
    nextStep: "Bring the detailed brief to your doctor or genetic counselor.",
    references: [],
    source: "fallback",
  };
}

export function SessionView({
  runId,
  demo,
  live = false,
  variant,
  clinicalContext,
  gene,
}: {
  runId: string;
  demo: DemoId;
  live?: boolean;
  variant?: string;
  clinicalContext?: string;
  gene?: string;
}) {
  const demoOutput = live ? null : DEMO_OUTPUTS[demo];

  const { fragments, pipeline, complete } = useEvidenceRun(runId, {
    source: live ? "live" : "fixture",
    fixture: DEMO_RUNS[demo],
    intervalMs: 850,
  });

  const statuses = stageStatuses({ fragments, pipeline, complete });

  // DNA view: live → from the live VEP fragment; demo → from the captured card.
  const liveVep = fragments.find((f) => f.source === "ensembl_vep");
  const seqCtx = React.useMemo(() => {
    if (live) return liveVep ? parseSequenceContext(liveVep, gene ?? variant ?? "") : null;
    return demoOutput ? sequenceContextFromCard(demoOutput.evidenceCard) : null;
  }, [live, liveVep, demoOutput, gene, variant]);

  const displayGene = seqCtx?.gene ?? gene ?? demoOutput?.evidenceCard.geneSymbol ?? "";
  const displayVariant = variant ?? demoOutput?.evidenceCard.variant ?? "";

  // Patient summary: written by Grok on completion (grounded in the real run
  // output), with a deterministic fallback so it always renders.
  const [summary, setSummary] = React.useState<PatientSummary | null>(null);
  const [writing, setWriting] = React.useState(false);
  const requestedRef = React.useRef(false);
  React.useEffect(() => {
    if (!complete || requestedRef.current) return;
    requestedRef.current = true;
    setWriting(true);
    summarizeForPatient(live ? { runId } : { runId, demo })
      .then((s) => setSummary(s))
      .catch(() => {
        if (!live && demoOutput) setSummary(buildPatientSummary(demoOutput));
        else setSummary(minimalSummary(pipeline.overall?.label ?? "low"));
      })
      .finally(() => setWriting(false));
  }, [complete, runId, demo, demoOutput, live, pipeline.overall?.label]);

  const briefParams = new URLSearchParams({ demo });
  if (live) briefParams.set("live", "1");
  if (variant) briefParams.set("variant", variant);
  if (clinicalContext) briefParams.set("context", clinicalContext);
  if (gene) briefParams.set("gene", gene);
  const briefHref = `/brief/${runId}?${briefParams.toString()}`;

  // ── follow-up Q&A (optional, grounded in this run) ─────────────────────────
  const { ttsSupported, sttSupported, listening, speak, cancelSpeech, listen, stopListening } = useSpeech();
  const [voiceOn, setVoiceOn] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [asking, setAsking] = React.useState(false);
  const [turns, setTurns] = React.useState<{ role: "user" | "assistant"; text: string }[]>([]);

  const buildContext = React.useCallback((): FollowupContext => {
    const lbl = (l: { label: string } | null) => (l ? l.label : "pending");
    const g = pipeline.mechanismGate;
    return {
      geneSymbol: displayGene || "this gene",
      variant: displayVariant,
      clinicalContext: clinicalContext ?? demoOutput?.evidenceCard.clinicalContext ?? "",
      overall: pipeline.overall?.label ?? summary?.confidence ?? null,
      pipelineSummary: `gene-prior ${lbl(pipeline.genePrior)}, variant-effect ${lbl(
        pipeline.variantEffect,
      )}, mechanism-gate ×${g ? g.value.toFixed(2) : "?"}, cross-species ${lbl(pipeline.crossSpecies)}`,
      evidence: fragments.map((f) => f.summary),
    };
  }, [pipeline, displayGene, displayVariant, clinicalContext, demoOutput, summary, fragments]);

  const ask = React.useCallback(
    (question: string) => {
      const q = question.trim();
      if (!q || asking) return;
      setDraft("");
      setTurns((t) => [...t, { role: "user", text: q }]);
      setAsking(true);
      askFollowup(q, buildContext())
        .then((res) => {
          const text = res.ok ? res.answer : res.reason;
          setTurns((t) => [...t, { role: "assistant", text }]);
          if (res.ok && voiceOn) speak(res.answer);
        })
        .catch(() => setTurns((t) => [...t, { role: "assistant", text: "The follow-up request failed." }]))
        .finally(() => setAsking(false));
    },
    [asking, buildContext, voiceOn, speak],
  );

  function onMic() {
    if (listening) {
      stopListening();
      return;
    }
    listen((text) => ask(text));
  }

  function toggleVoice() {
    setVoiceOn((on) => {
      if (on) cancelSpeech();
      return !on;
    });
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-card/80 px-4 py-2.5 backdrop-blur sm:px-6">
        <Link
          href="/"
          className="flex size-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Start over"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <span className="font-serif text-base font-semibold text-foreground">Your result</span>
        {displayGene && (
          <span className="font-mono text-xs text-muted-foreground">
            {displayGene} {displayVariant}
          </span>
        )}
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
          <h2 className="font-serif text-xl font-semibold text-foreground">The change we found in your DNA</h2>
          {seqCtx ? (
            <SequenceViewer ctx={seqCtx} />
          ) : live && !complete ? (
            <div className="flex items-center gap-3 rounded-xl border border-dashed bg-card/50 p-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Reading the DNA change in your file…
            </div>
          ) : (
            <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
              This variant doesn&rsquo;t map to a single DNA letter change we can draw.
            </p>
          )}
        </section>

        {/* 2 — what the agent is doing */}
        <section className="space-y-3">
          <h2 className="font-serif text-xl font-semibold text-foreground">What the agent is doing</h2>
          <ul className="rounded-xl border bg-card px-4 py-2 sm:px-5">
            {TRACE_STAGES.map((stage, i) => (
              <StageRow key={stage.id} stage={stage} status={statuses[i]} />
            ))}
          </ul>
        </section>

        {/* 3 — plain-language summary */}
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

              <p className="text-pretty text-base font-medium leading-relaxed text-foreground">{summary.headline}</p>

              <div className="space-y-2">
                {summary.body.map((line, i) => (
                  <p key={i} className="text-pretty text-sm leading-relaxed text-foreground/80">
                    {line}
                  </p>
                ))}
                {summary.mouseLine && (
                  <p className="text-pretty text-sm leading-relaxed text-foreground/80">{summary.mouseLine}</p>
                )}
              </div>

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
                      <span className="text-muted-foreground"> — {[r.journal, r.year].filter(Boolean).join(", ")}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* 4 — follow-up Q&A (optional; grounded in this run) */}
        {complete && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl font-semibold text-foreground">Ask a question</h2>
              {ttsSupported && (
                <button
                  type="button"
                  onClick={toggleVoice}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  aria-pressed={voiceOn}
                >
                  {voiceOn ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
                  {voiceOn ? "Read answers aloud" : "Voice off"}
                </button>
              )}
            </div>

            {turns.length > 0 && (
              <div className="space-y-2">
                {turns.map((t, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-xl border px-4 py-2.5 text-sm leading-relaxed",
                      t.role === "user" ? "bg-muted/40 text-foreground" : "bg-card text-foreground/90",
                    )}
                  >
                    {t.text}
                  </div>
                ))}
                {asking && (
                  <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" /> Thinking…
                  </div>
                )}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask(draft);
              }}
              className="flex items-center gap-2"
            >
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="e.g. Does this mean I'll definitely get sick?"
                className="flex-1"
              />
              {sttSupported && (
                <button
                  type="button"
                  onClick={onMic}
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
                    listening ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent",
                  )}
                  aria-label={listening ? "Stop listening" : "Ask by voice"}
                >
                  <Mic className="size-4" />
                </button>
              )}
              <button
                type="submit"
                disabled={asking || !draft.trim()}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50"
                aria-label="Send question"
              >
                <Send className="size-4" />
              </button>
            </form>
            <p className="px-1 text-[0.7rem] text-muted-foreground">
              Answers are grounded only in this run&rsquo;s evidence. Your doctor or genetic counselor decides.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
