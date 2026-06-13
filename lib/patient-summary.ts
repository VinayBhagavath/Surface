// Plain-language patient summary.
//
// Turns a completed RunOutput into a SHORT, jargon-free read-out a patient with
// no biology background can understand. This is derived deterministically from
// the pipeline's own result (overall label + the cross-species / mechanism-gate
// outcome) — no extra model call — so it always renders and never contradicts
// the confidence the engine actually computed.

import type { ConfidenceLabel, RunOutput } from "@/lib/types";
import { CLINICAL_CONTEXT_OPTIONS } from "@/lib/clinical-context-options";

export type SummaryReference = {
  title: string;
  journal: string | null;
  year: string | null;
  url: string | null;
};

export type PatientSummary = {
  confidence: ConfidenceLabel;
  /** 2-4 word verdict chip, e.g. "Likely important". */
  verdict: string;
  /** One-sentence headline in plain words. */
  headline: string;
  /** Two short plain-language sentences expanding the headline. */
  body: string[];
  /** What the mouse research contributed, in plain words (or null if N/A). */
  mouseLine: string | null;
  /** One-liner: what this result means for the patient's CRISPR / gene-therapy plan. */
  therapyNote: string;
  /** What to do next — always frames the doctor as the decision-maker. */
  nextStep: string;
  /** Real published papers the result is grounded in (Europe PMC). */
  references: SummaryReference[];
  /** Whether the prose was written by Grok or the deterministic fallback. */
  source: "grok" | "fallback";
};

/** Plain, exported so the server action can build the literature query. */
export function plainContextLabel(key: string): string {
  return contextLabel(key);
}

function contextLabel(key: string): string {
  const found = CLINICAL_CONTEXT_OPTIONS.find((o) => o.value === key);
  // strip the parenthetical / slash detail for the plainest phrasing
  const raw = found?.label ?? key.replace(/_/g, " ");
  return raw.split(/[/(]/)[0].trim().toLowerCase();
}

const VERDICT: Record<ConfidenceLabel, string> = {
  high: "Likely important",
  moderate: "Possibly important",
  low: "Still unclear",
};

const HEADLINE: Record<ConfidenceLabel, (gene: string, ctx: string) => string> = {
  high: (gene, ctx) =>
    `The evidence suggests this change in your ${gene} gene is likely connected to ${ctx}.`,
  moderate: (gene, ctx) =>
    `There are some signs this change in your ${gene} gene could be connected to ${ctx}, but it isn't certain.`,
  low: (gene, ctx) =>
    `There isn't enough evidence yet to say whether this change in your ${gene} gene is connected to ${ctx}.`,
};

export function buildPatientSummary(output: RunOutput): PatientSummary {
  const { evidenceCard: card, doctorBrief: brief } = output;
  const overall = brief.overall;
  const gene = card.geneSymbol;
  const ctx = contextLabel(card.clinicalContext);

  const gate = card.pipeline.mechanismGate;
  const cross = card.pipeline.crossSpecies;
  const gateClosed = gate != null && gate.value < 0.34;
  const crossStrong = cross != null && cross.label === "high";
  const crossNone =
    cross == null || (cross.label === "low" && !card.fragments.some((f) => f.source === "impc" && f.found));

  let mouseLine: string | null;
  if (gateClosed) {
    mouseLine =
      "Studies in mice did show effects, but they don't match the way this gene causes disease — so we set that evidence aside rather than let it mislead the result.";
  } else if (crossStrong) {
    mouseLine = `Mice with this same gene switched off developed problems that line up with ${ctx}, which strengthens the finding.`;
  } else if (crossNone) {
    mouseLine =
      "There wasn't enough mouse research available to add to the picture this time.";
  } else {
    mouseLine =
      "The mouse research added only a little to the picture.";
  }

  const body: string[] = [];
  if (overall === "high") {
    body.push(
      "Different lines of evidence — how the gene normally behaves, how this specific change is predicted to act, and animal research — mostly point the same way.",
    );
    body.push(
      "That agreement is why the result is rated with higher confidence.",
    );
  } else if (overall === "moderate") {
    body.push(
      "Some evidence points toward this change mattering, while other evidence is mixed or missing.",
    );
    body.push("That mix is why the result sits in the middle rather than being clear-cut.");
  } else {
    body.push(
      "The available evidence is sparse or pulls in different directions, so the change stays a 'variant of uncertain significance' for now.",
    );
    body.push(
      "This is not the same as saying it's harmless — it means we don't have enough to decide yet.",
    );
  }

  const nextStep =
    overall === "low"
      ? "Share this with your doctor or genetic counselor. New research or family testing could change the picture later — the system keeps watching for updates."
      : "Bring this to your doctor or genetic counselor. They can weigh it alongside your personal and family history before any decisions are made.";

  const therapyNote =
    overall === "high"
      ? `For a CRISPR or gene-therapy plan targeting ${gene}, this change looks like a real, relevant target — confirm it with your care team before proceeding.`
      : overall === "moderate"
        ? `Before a CRISPR or gene-therapy plan treats this ${gene} change as the target, your care team should confirm it — the evidence isn't fully settled yet.`
        : `This ${gene} change isn't yet proven to be the cause, so it shouldn't be assumed as the CRISPR or gene-therapy target until more evidence is in.`;

  return {
    confidence: overall,
    verdict: VERDICT[overall],
    headline: HEADLINE[overall](gene, ctx),
    body,
    mouseLine,
    therapyNote,
    nextStep,
    references: [],
    source: "fallback",
  };
}
