// The Doctor Brief document — a clinical one-pager rendered from a RunOutput.
// Server component (pure render). Print-optimized via `print:` utilities; the page
// chrome (back link, action buttons) lives in the route and is `print:hidden`.

import type { AcmgRow, ConfidenceLabel, RunOutput } from "@/lib/types";
import { sequenceContextFromCard } from "@/lib/sequence";
import { SequenceViewer } from "@/components/SequenceViewer";
import { cn } from "@/lib/utils";

const OVERALL: Record<ConfidenceLabel, { badge: string; dot: string; word: string }> = {
  high: {
    badge: "bg-confidence-high-soft text-confidence-high-ink",
    dot: "bg-confidence-high",
    word: "High",
  },
  moderate: {
    badge: "bg-confidence-moderate-soft text-confidence-moderate-ink",
    dot: "bg-confidence-moderate",
    word: "Moderate",
  },
  low: {
    badge: "bg-confidence-low-soft text-confidence-low-ink",
    dot: "bg-confidence-low",
    word: "Low",
  },
};

function fmtDate(iso: string): string {
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]} UTC` : iso;
}

function prettyContext(ctx: string): string {
  const s = ctx.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function LayerRow({
  label,
  meta,
  text,
  accent = false,
}: {
  label: string;
  meta?: string;
  text: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[9.5rem_1fr] gap-3 border-t py-2.5 first:border-t-0 sm:grid-cols-[11rem_1fr]",
        accent && "bg-muted/40",
      )}
    >
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {meta && (
          <span className="font-mono text-xs text-muted-foreground">{meta}</span>
        )}
      </div>
      <p className="text-sm leading-relaxed text-foreground/90">{text}</p>
    </div>
  );
}

function DirectionTag({ direction }: { direction: AcmgRow["direction"] }) {
  const pathogenic = direction === "pathogenic";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wider",
        pathogenic
          ? "bg-confidence-low-soft text-confidence-low-ink"
          : "bg-confidence-high-soft text-confidence-high-ink",
      )}
    >
      {direction}
    </span>
  );
}

export function BriefDocument({ output }: { output: RunOutput }) {
  const { doctorBrief: brief, evidenceCard } = output;
  const overall = OVERALL[brief.overall];
  const gateValue = evidenceCard.pipeline.mechanismGate?.value;
  const overallReason = evidenceCard.pipeline.overall?.reason;
  const caveats = brief.acmgRows.filter((r) => r.caveat);
  const sequence = sequenceContextFromCard(evidenceCard);

  return (
    <article className="rounded-2xl border bg-card p-8 text-foreground shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
      {/* letterhead */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
            VUS Resolution Report
          </p>
          <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">
            {brief.geneSymbol}{" "}
            <span className="font-mono text-xl font-normal text-muted-foreground">
              {brief.variant}
            </span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Clinical context: {prettyContext(brief.clinicalContext)}
          </p>
        </div>
        <div className="text-right">
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold",
              overall.badge,
            )}
          >
            <span className={cn("size-2.5 rounded-full", overall.dot)} />
            {overall.word} confidence
          </span>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {fmtDate(brief.generatedAt)}
          </p>
        </div>
      </header>

      {/* summary */}
      <section className="mt-6">
        <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
          Summary
        </h2>
        <p className="text-pretty mt-2 leading-relaxed">{brief.summary}</p>
      </section>

      {/* sequence context — DNA-level view of the substitution */}
      {sequence && (
        <section className="mt-6">
          <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
            Sequence context
          </h2>
          <div className="mt-2">
            <SequenceViewer ctx={sequence} />
          </div>
        </section>
      )}

      {/* confidence breakdown */}
      <section className="mt-6">
        <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
          Confidence breakdown
        </h2>
        {overallReason && (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Overall {overall.word}.</span>{" "}
            {overallReason}
          </p>
        )}
        <div className="mt-3 rounded-xl border px-4">
          <LayerRow label="Gene prior" text={brief.perLayerReasons.genePrior} />
          <LayerRow label="Variant effect" text={brief.perLayerReasons.variantEffect} />
          <LayerRow
            label="Mechanism gate"
            meta={gateValue != null ? `× ${gateValue.toFixed(2)} multiplier` : undefined}
            text={brief.perLayerReasons.mechanismGate}
            accent
          />
          <LayerRow label="Cross-species" text={brief.perLayerReasons.crossSpecies} />
        </div>
      </section>

      {/* ACMG / AMP */}
      <section className="mt-6">
        <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
          ACMG / AMP criteria
        </h2>
        <div className="mt-2 overflow-hidden rounded-xl border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Direction</th>
                <th className="px-3 py-2 font-medium">Strength</th>
                <th className="px-3 py-2 font-medium">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {brief.acmgRows.map((row, i) => (
                <tr key={`${row.code}-${i}`} className="border-b last:border-b-0 align-top">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-semibold">
                    {row.code}
                    {row.caveat && <sup className="text-muted-foreground"> †</sup>}
                  </td>
                  <td className="px-3 py-2">
                    <DirectionTag direction={row.direction} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                    {row.strength}
                  </td>
                  <td className="px-3 py-2 text-foreground/90">{row.fact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* caveats — rendered VERBATIM beneath the table */}
        {caveats.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {caveats.map((row, i) => (
              <p
                key={`caveat-${row.code}-${i}`}
                className="text-pretty text-xs leading-relaxed text-muted-foreground"
              >
                <span className="font-mono">† {row.code}:</span> {row.caveat}
              </p>
            ))}
          </div>
        )}
      </section>

      {/* not-high callouts */}
      {brief.whatWouldChangeThis && (
        <section className="mt-5 rounded-xl border-l-[3px] border-l-confidence-moderate bg-confidence-moderate-soft/40 px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">What would change this</h3>
          <p className="text-pretty mt-1 text-sm leading-relaxed text-foreground/90">
            {brief.whatWouldChangeThis}
          </p>
        </section>
      )}
      {brief.suggestedFollowUp && (
        <section className="mt-3 rounded-xl border-l-[3px] border-l-primary bg-accent/50 px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Suggested follow-up</h3>
          <p className="text-pretty mt-1 text-sm leading-relaxed text-foreground/90">
            {brief.suggestedFollowUp}
          </p>
        </section>
      )}

      {/* footer */}
      <footer className="mt-6 border-t pt-3 font-mono text-[0.65rem] leading-relaxed text-muted-foreground">
        Run {brief.runId} · generated {fmtDate(brief.generatedAt)} · Cross-species evidence is
        decision-support, not a clinical diagnosis. Confirm with an accredited laboratory.
      </footer>
    </article>
  );
}
