"use client";

// ConfidencePipelineStrip — the persistent confidence header.
// Gene Prior → Variant Effect → Mechanism Gate → Cross-Species (+ Overall).
//
// CONVENTION: the Mechanism Gate is a 0..1 MULTIPLIER, rendered as a sluice VALVE
// (a gate plate that descends to choke an evidence-flow channel), NOT a level bar.
// When the gate is low it visibly suppresses the Cross-Species segment downstream.
// Confidence colors come ONLY from the --confidence-* tokens in app/globals.css.

import * as React from "react";
import type { ConfidencePipelineState } from "@/lib/types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Level = "low" | "moderate" | "high";
type LayerValue = { value: number; label: Level; reason: string } | null;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const LEVEL_LABEL: Record<Level, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
};
const PIP_COUNT: Record<Level, number> = { low: 1, moderate: 2, high: 3 };

// Literal class strings only — so Tailwind v4 can see them at build time.
function tokens(level: Level | "pending") {
  switch (level) {
    case "high":
      return {
        ink: "text-confidence-high-ink",
        fill: "bg-confidence-high",
        border: "border-confidence-high/45",
        cssVar: "var(--confidence-high)",
      };
    case "moderate":
      return {
        ink: "text-confidence-moderate-ink",
        fill: "bg-confidence-moderate",
        border: "border-confidence-moderate/45",
        cssVar: "var(--confidence-moderate)",
      };
    case "low":
      return {
        ink: "text-confidence-low-ink",
        fill: "bg-confidence-low",
        border: "border-confidence-low/45",
        cssVar: "var(--confidence-low)",
      };
    default:
      return {
        ink: "text-confidence-pending-ink",
        fill: "bg-confidence-pending",
        border: "border-dashed border-border",
        cssVar: "var(--confidence-pending)",
      };
  }
}

/** A level layer (Gene Prior / Variant Effect / Cross-Species): a 3-pip meter. */
function LayerSegment({
  step,
  title,
  layer,
  dampen = 1,
}: {
  step: number;
  title: string;
  layer: LayerValue;
  dampen?: number; // visual flow reaching this layer (Cross-Species only)
}) {
  const level: Level | "pending" = layer ? layer.label : "pending";
  const t = tokens(level);
  const pips = layer ? PIP_COUNT[layer.label] : 0;
  const suppressed = !!layer && dampen < 0.5;

  const body = (
    <div
      className={cn(
        "relative flex h-full min-w-[8.25rem] flex-1 flex-col gap-2.5 rounded-xl border bg-card px-4 py-3.5 transition-[opacity,filter] duration-700",
        layer ? t.border : "border-dashed border-border",
      )}
      style={{
        opacity: 0.35 + 0.65 * dampen,
        filter:
          dampen < 0.999
            ? `saturate(${(0.12 + 0.88 * dampen).toFixed(3)})`
            : undefined,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground">
          {String(step).padStart(2, "0")}
        </span>
        {suppressed ? (
          <span className="rounded-full bg-confidence-low-soft px-2 py-[3px] font-mono text-[0.5rem] font-semibold uppercase tracking-[0.12em] text-confidence-low-ink">
            suppressed
          </span>
        ) : !layer ? (
          <span className="size-1.5 animate-pulse rounded-full bg-confidence-pending" />
        ) : null}
      </div>
      <div className="font-serif text-[0.95rem] font-medium leading-tight text-foreground">
        {title}
      </div>
      <div className="mt-auto flex items-end gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              "w-full rounded-[3px] transition-colors duration-700",
              i < pips ? t.fill : "bg-muted",
            )}
            style={{ height: `${9 + i * 6}px` }}
          />
        ))}
      </div>
      <div
        className={cn(
          "text-xs font-semibold",
          layer ? t.ink : "text-muted-foreground/70",
        )}
      >
        {layer ? LEVEL_LABEL[layer.label] : "Queued"}
      </div>
    </div>
  );

  if (!layer) return body;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{body}</TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[16rem] text-pretty">
        {layer.reason}
      </TooltipContent>
    </Tooltip>
  );
}

/** A small valve handwheel that sits atop the gate plate. */
function Handwheel({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" style={{ color }} aria-hidden>
      <circle cx="12" cy="12" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" />
      {[0, 60, 120].map((a) => (
        <line
          key={a}
          x1="12"
          y1="4"
          x2="12"
          y2="20"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          transform={`rotate(${a} 12 12)`}
        />
      ))}
    </svg>
  );
}

/** The Mechanism Gate — a sluice valve choking an evidence-flow channel. */
function MechanismGateValve({
  gate,
}: {
  gate: { value: number; reason: string } | null;
}) {
  const [entered, setEntered] = React.useState(false);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const pending = gate == null;
  const target = gate ? clamp01(gate.value) : 0.5;
  const openness = entered ? target : 0.5; // animate from neutral on mount

  const state: "open" | "partial" | "closed" | "pending" = pending
    ? "pending"
    : openness >= 0.66
      ? "open"
      : openness >= 0.34
        ? "partial"
        : "closed";
  const color =
    state === "open"
      ? "var(--confidence-high)"
      : state === "partial"
        ? "var(--confidence-moderate)"
        : state === "closed"
          ? "var(--confidence-low)"
          : "var(--confidence-pending)";
  const stateLabel = pending
    ? "Pending"
    : state === "open"
      ? "Open"
      : state === "partial"
        ? "Partial"
        : "Choked";

  const plateHeightPct = pending ? 46 : (1 - openness) * 100;
  const downstreamOpacity = pending ? 0.1 : 0.1 + 0.9 * openness;
  const stripe = `repeating-linear-gradient(115deg, var(--flow) 0 3px, transparent 3px 13px)`;

  const valve = (
    <div
      className="relative flex h-full min-w-[12rem] flex-[1.4] flex-col gap-2.5 rounded-xl border bg-card px-4 py-3.5 transition-shadow duration-700"
      style={{
        borderColor: pending ? undefined : color,
        boxShadow: pending
          ? undefined
          : `0 0 0 1px color-mix(in oklch, ${color} 30%, transparent), 0 10px 26px -18px ${color}`,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground">
          03 · gate
        </span>
        <span
          className="rounded-full px-2 py-[3px] font-mono text-[0.5rem] font-semibold uppercase tracking-[0.12em]"
          style={{
            background: `color-mix(in oklch, ${color} 14%, transparent)`,
            color,
          }}
        >
          {stateLabel}
        </span>
      </div>
      <div className="font-serif text-[0.95rem] font-medium leading-tight text-foreground">
        Mechanism Gate
      </div>

      {/* flow channel with the descending gate plate */}
      <div className="relative mt-auto h-12 overflow-hidden rounded-lg border border-border bg-muted/40">
        <div
          className="absolute inset-y-0 left-0 right-1/2"
          style={{
            backgroundImage: stripe,
            backgroundSize: "26px 100%",
            opacity: pending ? 0.12 : 0.5,
            animation: pending ? undefined : "flow-move 0.9s linear infinite",
          }}
        />
        <div
          className="absolute inset-y-0 left-1/2 right-0 transition-opacity duration-700"
          style={{
            backgroundImage: stripe,
            backgroundSize: "26px 100%",
            opacity: downstreamOpacity * 0.55,
            animation: pending ? undefined : "flow-move 0.9s linear infinite",
          }}
        />
        {/* gate seat */}
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border/80" />
        {/* gate plate descends from the top */}
        <div
          className="absolute left-1/2 top-0 w-[18px] -translate-x-1/2 rounded-b-[5px] transition-[height] duration-700 ease-out"
          style={{
            height: `${plateHeightPct}%`,
            background: `linear-gradient(180deg, color-mix(in oklch, ${color} 78%, white 14%), ${color})`,
            boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${color} 55%, white 30%), 0 2px 6px -2px ${color}`,
          }}
        />
        {/* handwheel sits on the gate stem */}
        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-card p-0.5">
          <Handwheel color={color} />
        </div>
      </div>

      <div className="flex items-baseline justify-between">
        <span
          className="font-mono text-sm font-semibold tabular-nums"
          style={{ color }}
        >
          {pending ? "× —" : `× ${target.toFixed(2)}`}
        </span>
        <span className="font-mono text-[0.55rem] uppercase tracking-[0.1em] text-muted-foreground">
          multiplier
        </span>
      </div>
    </div>
  );

  if (pending) return valve;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{valve}</TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[18rem] text-pretty">
        {gate.reason}
      </TooltipContent>
    </Tooltip>
  );
}

/** The connector pipe between segments; constricts when the gate is closed. */
function Connector({ flow = 1, gated = false }: { flow?: number; gated?: boolean }) {
  return (
    <div
      className="flex w-5 shrink-0 items-center justify-center self-center sm:w-7"
      aria-hidden
    >
      <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-border">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
          style={{
            width: `${Math.max(14, flow * 100)}%`,
            background:
              gated && flow < 0.5 ? "var(--confidence-low)" : "var(--flow)",
            opacity: 0.3 + 0.7 * flow,
          }}
        />
      </div>
    </div>
  );
}

function OverallBadge({
  overall,
}: {
  overall: ConfidencePipelineState["overall"];
}) {
  const t = tokens(overall ? overall.label : "pending");
  const inner = (
    <div className="flex min-w-[7.5rem] flex-col gap-1.5 rounded-xl border bg-card px-4 py-3.5">
      <span className="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground">
        overall
      </span>
      <div className="flex items-center gap-2">
        <span className={cn("size-3 rounded-full", t.fill)} />
        <span
          className={cn(
            "font-serif text-lg font-semibold leading-none",
            overall ? t.ink : "text-muted-foreground/70",
          )}
        >
          {overall ? LEVEL_LABEL[overall.label] : "Pending"}
        </span>
      </div>
      <span className="text-[0.7rem] text-muted-foreground">confidence</span>
    </div>
  );
  if (!overall) return inner;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{inner}</TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[18rem] text-pretty">
        {overall.reason}
      </TooltipContent>
    </Tooltip>
  );
}

export function ConfidencePipelineStrip({
  pipeline,
  className,
}: {
  pipeline: ConfidencePipelineState;
  className?: string;
}) {
  const gateFlow = pipeline.mechanismGate
    ? clamp01(pipeline.mechanismGate.value)
    : 1;

  const segments = [
    <LayerSegment key="gp" step={1} title="Gene Prior" layer={pipeline.genePrior} />,
    <LayerSegment
      key="ve"
      step={2}
      title="Variant Effect"
      layer={pipeline.variantEffect}
    />,
    <MechanismGateValve key="mg" gate={pipeline.mechanismGate} />,
    <LayerSegment
      key="cs"
      step={4}
      title="Cross-Species"
      layer={pipeline.crossSpecies}
      dampen={gateFlow}
    />,
  ];

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
        {segments.map((seg, i) => (
          <React.Fragment key={i}>
            {i > 0 && (
              <Connector flow={i === 3 ? gateFlow : 1} gated={i === 3} />
            )}
            <div
              className="seg-in flex"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              {seg}
            </div>
          </React.Fragment>
        ))}
        <div
          className="seg-in flex items-center"
          style={{ animationDelay: `${segments.length * 90}ms` }}
        >
          <div className="mx-1 h-12 w-px self-center bg-border" />
          <OverallBadge overall={pipeline.overall} />
        </div>
      </div>
    </div>
  );
}
