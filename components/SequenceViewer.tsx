// DNA-level sequence viewer for a VUS.
//
// Renders the affected codon as two aligned lanes — the reference (expected) and
// the observed sequence — with the single-base substitution highlighted. This is
// the "raw DNA code" view: a base is flagged where the observed nucleotide
// differs from what is normally expected (e.g. a C found where a T should be).
//
// Pure render / server-component-safe. All data comes from the captured VEP
// fragment via lib/sequence.ts — no flanking sequence is fabricated.

import type { SequenceBase, SequenceContext } from "@/lib/sequence";
import { cn } from "@/lib/utils";

const CONSEQUENCE_WORD: Record<string, string> = {
  missense: "missense",
  missense_variant: "missense",
  synonymous: "synonymous",
  stop_gained: "nonsense",
  frameshift: "frameshift",
};

function prettyConsequence(c: string | null): string | null {
  if (!c) return null;
  return CONSEQUENCE_WORD[c] ?? c.replace(/_/g, " ");
}

function fmtPos(n: number | null): string | null {
  return n == null ? null : n.toLocaleString("en-US");
}

/** One nucleotide tile. `lane` controls the accent for the changed base. */
function BaseTile({ base, lane }: { base: SequenceBase; lane: "ref" | "alt" }) {
  const changed = base.changed;
  return (
    <span
      className={cn(
        "relative flex size-9 items-center justify-center rounded-md border font-mono text-base font-semibold tabular-nums sm:size-10 sm:text-lg",
        !changed && "border-border bg-muted/40 text-muted-foreground",
        changed &&
          lane === "ref" &&
          "border-confidence-pending/60 bg-confidence-pending-soft text-confidence-pending-ink ring-1 ring-inset ring-confidence-pending/40",
        changed &&
          lane === "alt" &&
          "border-confidence-low/70 bg-confidence-low-soft text-confidence-low-ink ring-2 ring-inset ring-confidence-low/50 shadow-sm",
      )}
      aria-label={`${changed ? "substituted " : ""}base ${base.letter}`}
    >
      {base.letter}
    </span>
  );
}

function CodonLane({
  label,
  meta,
  codon,
  lane,
}: {
  label: string;
  meta?: string | null;
  codon: SequenceBase[];
  lane: "ref" | "alt";
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 shrink-0 text-right sm:w-24">
        <span className="block text-xs font-medium text-foreground">{label}</span>
        {meta && <span className="block font-mono text-[0.65rem] text-muted-foreground">{meta}</span>}
      </div>
      <div className="flex items-center gap-1.5" role="group" aria-label={`${label} codon`}>
        {codon.map((b) => (
          <BaseTile key={`${lane}-${b.index}`} base={b} lane={lane} />
        ))}
      </div>
    </div>
  );
}

export function SequenceViewer({
  ctx,
  className,
}: {
  ctx: SequenceContext;
  className?: string;
}) {
  const consequence = prettyConsequence(ctx.consequence);
  const coord =
    ctx.chrom && ctx.pos != null ? `GRCh38 · chr${ctx.chrom}:${fmtPos(ctx.pos)}` : null;
  const strandLabel = ctx.strand == null ? null : ctx.strand >= 0 ? "+ strand" : "− strand";
  const hasCodons = ctx.refCodon && ctx.altCodon;

  // index (1-based) of the changed base within the codon, for the ruler caret
  const changeIdx = ctx.refCodon?.findIndex((b) => b.changed) ?? -1;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card print:break-inside-avoid",
        className,
      )}
    >
      {/* metadata strip */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-muted/30 px-4 py-2.5">
        {coord && (
          <span className="font-mono text-[0.7rem] text-muted-foreground">{coord}</span>
        )}
        {strandLabel && (
          <span className="font-mono text-[0.7rem] text-muted-foreground">{strandLabel}</span>
        )}
        {ctx.transcript && (
          <span className="font-mono text-[0.7rem] text-muted-foreground">{ctx.transcript}</span>
        )}
        {consequence && (
          <span className="ml-auto rounded-full bg-confidence-low-soft px-2 py-0.5 font-mono text-[0.6rem] font-medium uppercase tracking-wider text-confidence-low-ink">
            {consequence}
          </span>
        )}
      </div>

      <div className="px-4 py-4 sm:px-5">
        {hasCodons ? (
          <div className="space-y-2.5">
            <CodonLane
              label="Expected"
              meta={ctx.aminoRef ? `${ctx.aminoRef}${ctx.proteinPos ?? ""}` : "reference"}
              codon={ctx.refCodon!}
              lane="ref"
            />

            {/* substitution caret between the lanes */}
            {changeIdx >= 0 && (
              <div className="flex items-center gap-3" aria-hidden="true">
                <div className="w-20 shrink-0 sm:w-24" />
                <div className="flex items-center gap-1.5">
                  {ctx.refCodon!.map((b) => (
                    <span
                      key={`caret-${b.index}`}
                      className="flex size-9 items-center justify-center sm:size-10"
                    >
                      {b.changed && (
                        <span className="font-mono text-xs font-semibold text-confidence-low">
                          {ctx.refBase}→{ctx.altBase}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <CodonLane
              label="Observed"
              meta={ctx.aminoAlt ? `${ctx.aminoAlt}${ctx.proteinPos ?? ""}` : "this patient"}
              codon={ctx.altCodon!}
              lane="alt"
            />
          </div>
        ) : (
          // fallback: no codon triplet, show the bare base swap
          <div className="flex items-center gap-3">
            <BaseTile base={{ letter: ctx.refBase!, index: 0, changed: true }} lane="ref" />
            <span className="font-mono text-sm text-muted-foreground">→</span>
            <BaseTile base={{ letter: ctx.altBase!, index: 0, changed: true }} lane="alt" />
          </div>
        )}

        {/* plain-language read-out */}
        <p className="text-pretty mt-4 border-t pt-3 text-sm leading-relaxed text-foreground/90">
          <span className="font-medium text-foreground">
            A single-base substitution
          </span>{" "}
          {ctx.cdnaPos != null && (
            <>
              at <span className="font-mono text-confidence-low-ink">c.{ctx.cdnaPos}</span>:{" "}
            </>
          )}
          a{" "}
          <span className="font-mono font-semibold text-confidence-low-ink">{ctx.altBase}</span>{" "}
          is found where a{" "}
          <span className="font-mono font-semibold text-confidence-pending-ink">
            {ctx.refBase}
          </span>{" "}
          is normally expected
          {ctx.aminoRef && ctx.aminoAlt && ctx.proteinPos != null ? (
            <>
              , changing residue{" "}
              <span className="font-mono">
                {ctx.aminoRef}
                {ctx.proteinPos}
                {ctx.aminoAlt}
              </span>{" "}
              {ctx.hgvsp && <span className="text-muted-foreground">({ctx.hgvsp})</span>}
            </>
          ) : (
            "."
          )}
          {ctx.aminoRef && ctx.aminoAlt && "."}
        </p>
      </div>
    </div>
  );
}
