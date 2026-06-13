"use client";

// Intro "decode" animation shown between the file upload and the result page.
//
// It previews the uploaded sequence as a strip of codon groups, then sweeps a
// scanner left → right, marking each group OK (green) or "possible VUS" (orange)
// as it passes. Once the scan reaches the uncertain change, every healthy group
// floats away and the single VUS group zooms up to center stage — handing off to
// the real result view ("The change we found in your DNA").
//
// The uncertain (orange) group is the REAL substitution from the run's sequence
// context; the surrounding groups are a deterministic scanning visualisation
// (clearly a transition, never presented as the patient's flanking genome).

import * as React from "react";
import { Check, AlertTriangle, Dna } from "lucide-react";

import type { SequenceContext } from "@/lib/sequence";
import { cn } from "@/lib/utils";

const NUCLEOTIDES = ["A", "C", "G", "T"] as const;
const TOTAL_GROUPS = 9;
const VUS_AT = 4; // center the uncertain change in the strip
const REVEAL_MS = 300; // cadence of the left→right scan

type Group = {
  id: number;
  bases: string[];
  isVus: boolean;
  changedIndex: number;
};

/** Tiny deterministic PRNG so the decorative bases are stable per variant. */
function makeRng(seed: number) {
  let s = seed % 4294967296;
  if (s <= 0) s = 7;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function buildGroups(ctx: SequenceContext): Group[] {
  const seed =
    (ctx.gene ?? "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) +
    (ctx.cdnaPos ?? ctx.pos ?? 17);
  const rand = makeRng(seed);

  const groups: Group[] = [];
  for (let i = 0; i < TOTAL_GROUPS; i++) {
    if (i === VUS_AT) {
      const codon =
        ctx.altCodon?.map((b) => b.letter).slice(0, 3) ??
        [ctx.refBase ?? "A", ctx.altBase ?? "C", "G"];
      const changedIndex = ctx.altCodon?.findIndex((b) => b.changed) ?? 0;
      groups.push({
        id: i,
        bases: codon.length === 3 ? codon : [...codon, "G"].slice(0, 3),
        isVus: true,
        changedIndex: changedIndex < 0 ? 0 : changedIndex,
      });
    } else {
      groups.push({
        id: i,
        bases: [0, 1, 2].map(() => NUCLEOTIDES[Math.floor(rand() * 4)]),
        isVus: false,
        changedIndex: -1,
      });
    }
  }
  return groups;
}

type Phase = "scan" | "isolate" | "zoom";

function BaseTile({
  letter,
  state,
  changed,
  small,
}: {
  letter: string;
  state: "idle" | "ok" | "vus";
  changed?: boolean;
  small?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-md border font-mono font-semibold tabular-nums transition-all duration-500 ease-out",
        small ? "size-7 text-sm sm:size-8 sm:text-base" : "size-12 text-xl sm:size-14 sm:text-2xl",
        state === "idle" && "border-border bg-muted/50 text-muted-foreground/70",
        state === "ok" &&
          "border-confidence-high/40 bg-confidence-high-soft text-confidence-high-ink",
        state === "vus" &&
          !changed &&
          "border-confidence-low/50 bg-confidence-low-soft/70 text-confidence-low-ink",
        state === "vus" &&
          changed &&
          "border-confidence-low/80 bg-confidence-low-soft text-confidence-low-ink ring-2 ring-inset ring-confidence-low/60 shadow-sm",
      )}
    >
      {letter}
    </span>
  );
}

export function SequenceDecodeAnimation({
  ctx,
  onDone,
}: {
  ctx: SequenceContext;
  onDone: () => void;
}) {
  const groups = React.useMemo(() => buildGroups(ctx), [ctx]);
  const [revealed, setRevealed] = React.useState(0);
  const [phase, setPhase] = React.useState<Phase>("scan");

  const stripRef = React.useRef<HTMLDivElement>(null);
  const groupRefs = React.useRef<(HTMLDivElement | null)[]>([]);

  // Orchestrate the timeline: reveal groups left→right, then isolate, then zoom.
  React.useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let i = 0;

    const start = setTimeout(() => {
      const iv = setInterval(() => {
        i += 1;
        setRevealed(i);
        if (i >= groups.length) {
          clearInterval(iv);
          timers.push(setTimeout(() => setPhase("isolate"), 650));
          timers.push(setTimeout(() => setPhase("zoom"), 1550));
          timers.push(setTimeout(() => onDone(), 3250));
        }
      }, REVEAL_MS);
      timers.push(iv as unknown as ReturnType<typeof setTimeout>);
    }, 500);

    return () => {
      clearTimeout(start);
      timers.forEach((t) => clearTimeout(t));
    };
  }, [groups.length, onDone]);

  // Keep the active (or the VUS) group centered as the strip advances.
  React.useEffect(() => {
    const target = phase === "scan" ? Math.min(revealed, groups.length - 1) : VUS_AT;
    const el = groupRefs.current[target];
    const container = stripRef.current;
    if (!el || !container) return;
    const left = el.offsetLeft - container.clientWidth / 2 + el.clientWidth / 2;
    container.scrollTo({ left, behavior: "smooth" });
  }, [revealed, phase, groups.length]);

  const vusGroup = groups[VUS_AT];
  const caption =
    phase === "scan"
      ? revealed >= groups.length
        ? "Sequence decoded"
        : "Scanning your sequence for variants\u2026"
      : phase === "isolate"
        ? "One change stands out"
        : "The change we found";

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-background px-4">
      {/* status line */}
      <div
        className={cn(
          "mb-10 flex flex-col items-center gap-3 text-center transition-opacity duration-300",
          phase === "zoom" ? "opacity-0" : "opacity-100",
        )}
      >
        <span className="inline-flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground">
          <Dna className="size-3.5 animate-dna-bob" />
          {ctx.gene}
        </span>
        <h2
          key={caption}
          className="seg-in text-balance font-serif text-2xl font-semibold leading-tight text-foreground sm:text-3xl"
        >
          {caption}
        </h2>
      </div>

      {/* ── filmstrip (scan + isolate) ── */}
      <div
        className={cn(
          "relative w-full max-w-3xl transition-opacity",
          phase === "zoom"
            ? "pointer-events-none opacity-0 duration-200"
            : "opacity-100 duration-500",
        )}
      >
        {/* soft scan beam */}
        {phase === "scan" && revealed < groups.length && (
          <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-primary/50 to-transparent animate-soft-pulse" />
        )}
        <div
          ref={stripRef}
          className="flex items-end gap-3 overflow-hidden px-[50%] py-6 sm:gap-4"
        >
          {groups.map((g, gi) => {
            const isRevealed = revealed > gi;
            const state: "idle" | "ok" | "vus" = !isRevealed
              ? "idle"
              : g.isVus
                ? "vus"
                : "ok";
            const fadedOut = phase !== "scan" && !g.isVus;
            return (
              <div
                key={g.id}
                ref={(el) => {
                  groupRefs.current[gi] = el;
                }}
                className={cn(
                  "flex shrink-0 flex-col items-center gap-2 transition-all duration-700 ease-out",
                  fadedOut ? "translate-y-3 opacity-0" : "opacity-100",
                  isRevealed && g.isVus && phase === "scan" && "animate-dna-bob",
                )}
              >
                <div className={cn("flex items-center gap-1.5", isRevealed && "animate-dna-pop")}>
                  {g.bases.map((b, bi) => (
                    <BaseTile
                      key={bi}
                      letter={b}
                      state={state}
                      changed={g.isVus && bi === g.changedIndex}
                      small
                    />
                  ))}
                </div>
                {/* per-group verdict chip */}
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6rem] font-medium transition-all duration-300",
                    !isRevealed && "border-transparent text-transparent",
                    isRevealed &&
                      !g.isVus &&
                      "border-confidence-high/30 bg-confidence-high-soft text-confidence-high-ink",
                    isRevealed &&
                      g.isVus &&
                      "border-confidence-low/40 bg-confidence-low-soft text-confidence-low-ink",
                  )}
                >
                  {isRevealed && !g.isVus && (
                    <>
                      <Check className="size-2.5" /> OK
                    </>
                  )}
                  {isRevealed && g.isVus && (
                    <>
                      <AlertTriangle className="size-2.5" /> Possible VUS
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── zoomed VUS hero ── */}
      {phase === "zoom" && (
        <div className="animate-vus-zoom-in absolute inset-0 flex flex-col items-center justify-center gap-6 px-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-confidence-low/40 bg-confidence-low-soft px-3 py-1 text-xs font-semibold uppercase tracking-wide text-confidence-low-ink">
            <AlertTriangle className="size-3.5" /> Variant of uncertain significance
          </span>
          <div className="flex items-center gap-2 sm:gap-3">
            {vusGroup.bases.map((b, bi) => (
              <BaseTile
                key={bi}
                letter={b}
                state="vus"
                changed={bi === vusGroup.changedIndex}
              />
            ))}
          </div>
          {ctx.refBase && ctx.altBase && (
            <p className="font-mono text-sm text-muted-foreground">
              <span className="font-semibold text-confidence-pending-ink">{ctx.refBase}</span>
              {" \u2192 "}
              <span className="font-semibold text-confidence-low-ink">{ctx.altBase}</span>
              {ctx.hgvsc && <span className="ml-2 text-muted-foreground/70">{ctx.hgvsc}</span>}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
