"use client";

// The core experience: a live evidence-trajectory session.
//   • persistent ConfidencePipelineStrip header (gate animates; closed gate dampens cross-species)
//   • right pane: Evidence Trajectory — one card per fragment + a Mechanism-Gate marker + queued
//     placeholders for steps not yet reached
//   • left pane: Conversation — the narration stream (the readable backbone) + voice + follow-up Q&A
// Driven by useEvidenceRun in fixture mode; the live swap (Step 9) changes nothing here.
//
// Voice (Step 10) is additive + strictly optional: browser speech for I/O, Grok for follow-up
// reasoning. Everything works fully in text if voice is off / unsupported / the key is missing.

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Database,
  Dna,
  Eye,
  GitBranch,
  Layers,
  Loader2,
  type LucideIcon,
  Mic,
  Microscope,
  Send,
  Share2,
  Sparkles,
  User,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";

import type { EvidenceFragment, EvidenceSource } from "@/lib/types";
import { useEvidenceRun } from "@/lib/useEvidenceRun";
import { useSpeech } from "@/lib/voice/useSpeech";
import { askFollowup, type FollowupContext } from "@/app/actions/ask-followup";
import { DEMO_BY_ID, DEMO_RUNS, type DemoId } from "@/fixtures/runs";
import { ConfidencePipelineStrip } from "@/components/ConfidencePipelineStrip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const SOURCE_META: Record<EvidenceSource, { label: string; Icon: LucideIcon }> = {
  ensembl_vep: { label: "Ensembl VEP", Icon: Dna },
  gnomad_constraint: { label: "gnomAD constraint", Icon: Activity },
  myvariant: { label: "MyVariant", Icon: Database },
  ensembl_conservation: { label: "Conservation", Icon: Layers },
  ensembl_diopt: { label: "Ortholog · DIOPT", Icon: GitBranch },
  impc: { label: "IMPC · mouse knockout", Icon: Microscope },
  monarch_phenodigm: { label: "Monarch Phenodigm", Icon: Share2 },
};

const RELEVANCE_CLASS: Record<string, string> = {
  high: "bg-confidence-high-soft text-confidence-high-ink",
  medium: "bg-confidence-moderate-soft text-confidence-moderate-ink",
  low: "bg-confidence-pending-soft text-confidence-pending-ink",
  unscored: "bg-muted text-muted-foreground",
};

function toneDot(tone: "high" | "low" | "pending"): string {
  return tone === "high"
    ? "bg-confidence-high"
    : tone === "low"
      ? "bg-confidence-low"
      : "bg-confidence-pending";
}

const STEP_ROADMAP: { step: number; label: string }[] = [
  { step: 1, label: "Gene constraint" },
  { step: 2, label: "Variant effect" },
  { step: 3, label: "Mechanism gate" },
  { step: 4, label: "Cross-species evidence" },
];

function EvidenceCardItem({ fragment }: { fragment: EvidenceFragment }) {
  const meta = SOURCE_META[fragment.source];
  const Icon = meta.Icon;
  return (
    <div
      className={cn(
        "seg-in rounded-xl border bg-card p-4 shadow-sm",
        !fragment.found && "opacity-70",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Icon className="size-4 text-muted-foreground" />
          {meta.label}
        </span>
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">
          step {fragment.step}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-foreground/90">{fragment.summary}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {fragment.relevance && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-mono text-[0.6rem] font-medium uppercase tracking-wider",
              RELEVANCE_CLASS[fragment.relevance] ?? RELEVANCE_CLASS.unscored,
            )}
          >
            relevance · {fragment.relevance}
          </span>
        )}
        {!fragment.found && (
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground">
            no data
          </span>
        )}
      </div>
    </div>
  );
}

function GateMarker({ gate }: { gate: { value: number; reason: string } }) {
  const v = Math.max(0, Math.min(1, gate.value));
  const state = v >= 0.66 ? "open" : v >= 0.34 ? "partial" : "closed";
  const color =
    state === "open"
      ? "var(--confidence-high)"
      : state === "partial"
        ? "var(--confidence-moderate)"
        : "var(--confidence-low)";
  return (
    <div
      className="seg-in rounded-xl border-l-[3px] bg-card/60 px-4 py-3"
      style={{ borderLeftColor: color }}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">
          mechanism gate
        </span>
        <span className="font-mono text-sm font-semibold tabular-nums" style={{ color }}>
          × {v.toFixed(2)}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{gate.reason}</p>
    </div>
  );
}

function QueuedItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-dashed bg-card/40 px-4 py-3">
      <span className="size-1.5 animate-pulse rounded-full bg-confidence-pending" />
      <span className="text-sm text-muted-foreground/80">{label}</span>
      <span className="ml-auto font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground/60">
        queued
      </span>
    </div>
  );
}

type ChatMsg = { role: "user" | "assistant"; text: string };

export function SessionView({ runId, demo }: { runId: string; demo: DemoId }) {
  const meta = DEMO_BY_ID[demo];
  const { fragments, pipeline, narrations, complete } = useEvidenceRun(runId, {
    source: "fixture",
    fixture: DEMO_RUNS[demo],
    intervalMs: 700,
  });

  // ── voice (additive, optional) ──
  const { ttsSupported, sttSupported, listening, speak, cancelSpeech, listen, stopListening } =
    useSpeech();
  const [voiceOn, setVoiceOn] = React.useState(false);
  const spokenRef = React.useRef(0);
  const [followups, setFollowups] = React.useState<ChatMsg[]>([]);
  const [draft, setDraft] = React.useState("");
  const [asking, setAsking] = React.useState(false);

  // speak each NEW narration when voice is on (no backlog flood on toggle)
  React.useEffect(() => {
    if (!voiceOn) {
      spokenRef.current = narrations.length;
      return;
    }
    for (let i = spokenRef.current; i < narrations.length; i++) speak(narrations[i]);
    spokenRef.current = narrations.length;
  }, [voiceOn, narrations, speak]);

  function toggleVoice() {
    setVoiceOn((on) => {
      if (on) cancelSpeech();
      return !on;
    });
  }

  function buildContext(): FollowupContext {
    const lbl = (l: { label: string } | null) => (l ? l.label : "pending");
    const gate = pipeline.mechanismGate;
    return {
      geneSymbol: meta.gene,
      variant: meta.variant,
      clinicalContext: meta.clinicalContext,
      overall: pipeline.overall?.label ?? null,
      pipelineSummary: `gene-prior ${lbl(pipeline.genePrior)}, variant-effect ${lbl(
        pipeline.variantEffect,
      )}, mechanism-gate ×${gate ? gate.value.toFixed(2) : "?"}, cross-species ${lbl(
        pipeline.crossSpecies,
      )}, overall ${pipeline.overall?.label ?? "pending"}`,
      evidence: fragments.map((f) => f.summary),
    };
  }

  function handleAsk(question: string) {
    const q = question.trim();
    if (!q || asking) return;
    setDraft("");
    setFollowups((prev) => [...prev, { role: "user", text: q }]);
    setAsking(true);
    askFollowup(q, buildContext())
      .then((res) => {
        setAsking(false);
        if (res.ok) {
          setFollowups((prev) => [...prev, { role: "assistant", text: res.answer }]);
          if (voiceOn) speak(res.answer);
        } else {
          toast.error(res.reason);
          setFollowups((prev) => [...prev, { role: "assistant", text: res.reason }]);
        }
      })
      .catch(() => {
        setAsking(false);
        toast.error("The follow-up request failed.");
      });
  }

  function onMic() {
    if (!sttSupported) {
      toast.error("Voice input isn't supported in this browser.");
      return;
    }
    if (listening) {
      stopListening();
      return;
    }
    listen((text) => handleAsk(text));
  }

  const trajectoryEndRef = React.useRef<HTMLDivElement>(null);
  const conversationEndRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    trajectoryEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [fragments.length, pipeline.mechanismGate]);
  React.useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [narrations.length, complete, followups.length, asking]);

  // trajectory render list: fragments + gate marker (before cross-species) + queued
  const gate = pipeline.mechanismGate;
  const arrivedSteps = new Set<number>(fragments.map((f) => f.step));
  const reached = (s: number) => arrivedSteps.has(s) || (s === 3 && gate != null);

  const items: React.ReactNode[] = [];
  let gateInserted = false;
  for (const f of fragments) {
    if (!gateInserted && gate != null && f.step >= 4) {
      items.push(<GateMarker key="gate-marker" gate={gate} />);
      gateInserted = true;
    }
    items.push(<EvidenceCardItem key={f.id} fragment={f} />);
  }
  if (gate != null && !gateInserted) items.push(<GateMarker key="gate-marker" gate={gate} />);
  if (!complete && fragments.length > 0) {
    for (const r of STEP_ROADMAP) {
      if (!reached(r.step)) items.push(<QueuedItem key={`queued-${r.step}`} label={r.label} />);
    }
  }

  const briefHref = `/brief/${runId}?demo=${demo}`;

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      {/* top bar */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b bg-card/80 px-4 py-2.5 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex size-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Back to intake"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="font-serif text-base font-semibold text-foreground">
                {meta.gene}
              </span>
              <span className="font-mono text-xs text-muted-foreground">{meta.variant}</span>
            </div>
            <span className="font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">
              {meta.clinicalContext.replace(/_/g, " ")} · run {runId.slice(0, 8)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden items-center gap-1.5 md:flex">
            <span className={cn("size-2 rounded-full", toneDot(meta.tone))} />
            <span className="text-xs text-muted-foreground">{meta.scenario}</span>
          </span>
          {ttsSupported && (
            <Button
              variant={voiceOn ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={toggleVoice}
              aria-pressed={voiceOn}
            >
              {voiceOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              <span className="hidden sm:inline">{voiceOn ? "Voice on" : "Voice off"}</span>
            </Button>
          )}
          {complete ? (
            <Button asChild size="sm" className="gap-1.5">
              <Link href={briefHref}>
                View brief <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          ) : (
            <span className="flex items-center gap-1.5 font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">
              <Sparkles className="size-3.5 animate-pulse" /> resolving…
            </span>
          )}
        </div>
      </header>

      {/* pipeline strip header */}
      <div className="shrink-0 border-b bg-card/40 px-4 py-3 sm:px-6">
        <ConfidencePipelineStrip pipeline={pipeline} />
      </div>

      {/* two panes */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)]">
        {/* conversation */}
        <section className="flex min-h-0 flex-col border-b lg:border-b-0 lg:border-r">
          <h2 className="shrink-0 px-5 pb-1 pt-4 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
            Conversation
          </h2>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-3">
            {narrations.length === 0 && (
              <p className="text-sm text-muted-foreground/70">
                The agent will narrate its reasoning here as it works.
              </p>
            )}
            {narrations.map((n, i) => (
              <div key={`n-${i}`} className="seg-in flex gap-2.5">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="size-3" />
                </span>
                <p className="text-pretty rounded-2xl rounded-tl-sm bg-muted/60 px-3.5 py-2 text-sm leading-relaxed text-foreground">
                  {n}
                </p>
              </div>
            ))}
            {!complete && narrations.length > 0 && (
              <div className="flex gap-1 pl-9 text-muted-foreground">
                <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-current" />
              </div>
            )}
            {complete && (
              <div className="seg-in space-y-3 rounded-2xl border bg-card p-4">
                <p className="text-sm font-medium text-foreground">
                  Analysis complete — the doctor&rsquo;s brief is ready.
                </p>
                <Button asChild className="w-full gap-2">
                  <Link href={briefHref}>
                    View your Doctor Brief <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Link
                  href="/watch"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Eye className="size-3.5" />
                  Watching this variant for reclassification.
                </Link>
              </div>
            )}

            {/* follow-up Q&A thread */}
            {followups.map((m, i) => (
              <div
                key={`f-${i}`}
                className={cn("seg-in flex gap-2.5", m.role === "user" && "flex-row-reverse")}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                    m.role === "user"
                      ? "bg-foreground/10 text-foreground"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  {m.role === "user" ? <User className="size-3" /> : <Sparkles className="size-3" />}
                </span>
                <p
                  className={cn(
                    "text-pretty rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                    m.role === "user"
                      ? "rounded-tr-sm bg-primary text-primary-foreground"
                      : "rounded-tl-sm bg-muted/60 text-foreground",
                  )}
                >
                  {m.text}
                </p>
              </div>
            ))}
            {asking && (
              <div className="flex gap-1 pl-9 text-muted-foreground">
                <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-current" />
              </div>
            )}
            <div ref={conversationEndRef} />
          </div>

          {/* follow-up composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk(draft);
            }}
            className="flex shrink-0 items-center gap-2 border-t bg-card/60 p-3"
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={listening ? "Listening…" : "Ask a follow-up about this result…"}
              disabled={asking}
              aria-label="Ask a follow-up"
            />
            {sttSupported && (
              <Button
                type="button"
                variant={listening ? "default" : "outline"}
                size="icon"
                onClick={onMic}
                aria-label={listening ? "Stop listening" : "Voice input"}
              >
                <Mic className="size-4" />
              </Button>
            )}
            <Button type="submit" size="icon" disabled={asking || !draft.trim()} aria-label="Send">
              {asking ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </form>
        </section>

        {/* evidence trajectory */}
        <section className="flex min-h-0 flex-col">
          <h2 className="shrink-0 px-5 pb-1 pt-4 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
            Evidence trajectory
          </h2>
          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 py-3">
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground/70">Gathering evidence…</p>
            )}
            {items}
            <div ref={trajectoryEndRef} />
          </div>
        </section>
      </div>
    </div>
  );
}
