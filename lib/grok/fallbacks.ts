// Deterministic, HONEST fallbacks for each Grok reasoning call.
//
// If a reasoning call ultimately fails (after the client's own retries and, on
// Inngest, the step retries), the pipeline degrades to these instead of
// crashing the run. They are computed from the SAME real connector numbers the
// model would have seen — nothing is fabricated — and every one carries an
// explicit "AI reasoning unavailable" note so the brief stays truthful about
// how it was produced. The mechanism gate fallback is conservative (0.5), never
// silently 1.0.

import type {
  PredictorLeadership,
  MechanismGate,
  CrossSpecies,
  Synthesis,
} from "@/lib/grok/schemas";
import type { ConfidenceLabel, ConfidencePipelineState } from "@/lib/types";

export const GROK_UNAVAILABLE_NOTE =
  "AI reasoning was unavailable for this step; the result uses the deterministic evidence model only.";

type PredictorInput = {
  consequenceClass: string;
  alphamissense: { score: number | null; label: string | null };
  revel: number | null;
  cadd: number | null;
  conservation: { gerp: number | null; phyloP: number | null };
};

export function predictorLeadershipFallback(input: PredictorInput): PredictorLeadership {
  const am = input.alphamissense.score;
  const revel = input.revel;
  const cadd = input.cadd;

  let direction: PredictorLeadership["direction"] = "uncertain";
  let headlinePredictor = "CADD";
  let headlineValue = cadd != null ? `${cadd} (CADD phred)` : "unavailable";

  const cls = input.consequenceClass.toLowerCase();
  if (cls.includes("splice")) {
    headlinePredictor = "SpliceAI";
  } else if (cls.includes("missense")) {
    headlinePredictor = "AlphaMissense";
  }

  // Direction from the strongest available raw score — real numbers, no invention.
  if (am != null) {
    direction = am >= 0.564 ? "deleterious" : am <= 0.34 ? "benign" : "uncertain";
    headlineValue = `${am.toFixed(3)}${input.alphamissense.label ? ` (${input.alphamissense.label})` : ""}`;
  } else if (revel != null) {
    direction = revel >= 0.75 ? "deleterious" : revel <= 0.25 ? "benign" : "uncertain";
    if (headlinePredictor === "CADD") {
      headlinePredictor = "REVEL";
      headlineValue = `${revel.toFixed(3)} (REVEL)`;
    }
  } else if (cadd != null) {
    direction = cadd >= 20 ? "deleterious" : "uncertain";
  }

  const gerp = input.conservation.gerp;
  const phyloP = input.conservation.phyloP;
  const conservationSupport: PredictorLeadership["conservationSupport"] =
    (gerp != null && gerp >= 4) || (phyloP != null && phyloP >= 2)
      ? "supports"
      : gerp != null && gerp <= 0
        ? "undercuts"
        : "neutral";

  return {
    headlinePredictor,
    headlineValue,
    direction,
    agreement: "mixed", // we cannot adjudicate agreement deterministically — say so honestly
    disagreementNote: null,
    conservationSupport,
    interpretation: `${GROK_UNAVAILABLE_NOTE} Direction (${direction}) inferred directly from the raw predictor scores.`,
  };
}

/** Conservative gate when the mechanism-gate reasoning call fails. NEVER 1.0. */
export function mechanismGateFallback(): MechanismGate {
  return {
    gate: 0.5,
    mouseInformative: false,
    reason: `Mechanism gate unconfirmed — ${GROK_UNAVAILABLE_NOTE} Applying a neutral 0.5 multiplier rather than assuming the knockout is fully informative.`,
  };
}

type CrossSpeciesInput = {
  monarchSimilarity: number | null;
  lethal: boolean;
  anyImpcFound: boolean;
};

export function crossSpeciesFallback(input: CrossSpeciesInput): CrossSpecies {
  const strength: CrossSpecies["crossSpeciesStrength"] = input.lethal
    ? "moderate"
    : input.monarchSimilarity != null && input.monarchSimilarity >= 8
      ? "moderate"
      : "low";
  return {
    verdict: "insufficient",
    crossSpeciesStrength: strength,
    lethalityHandled: input.lethal,
    narration: `${GROK_UNAVAILABLE_NOTE} Using the computed cross-species similarity${
      input.lethal ? " and the knockout lethality signal" : ""
    } directly.`,
    relevanceById: {}, // leave IMPC fragments unscored rather than invent relevance
  };
}

type SynthesisInput = {
  geneSymbol: string;
  variant: string;
  clinicalContext: string;
  computedOverall: ConfidenceLabel;
  pipeline: ConfidencePipelineState;
};

export function synthesisFallback(input: SynthesisInput): Synthesis {
  const { pipeline: p } = input;
  const layer = (label: string, s: { label: string } | null) =>
    s ? `${label} ${s.label}` : null;
  const gateMult = p.mechanismGate ? `mechanism gate ×${p.mechanismGate.value.toFixed(2)}` : null;
  const layers = [
    layer("gene prior", p.genePrior),
    layer("variant effect", p.variantEffect),
    gateMult,
    layer("cross-species", p.crossSpecies),
  ]
    .filter(Boolean)
    .join(", ");

  const headline = `For ${input.geneSymbol} ${input.variant} (${input.clinicalContext}), the deterministic model rates the overall confidence "${input.computedOverall}" from: ${layers}.`;

  return {
    overallReason: `The overall rating "${input.computedOverall}" comes from the deterministic layered confidence model. ${GROK_UNAVAILABLE_NOTE}`,
    plainLanguageSummary: `${headline} ${GROK_UNAVAILABLE_NOTE} This brief was assembled from the measured evidence layers without the written AI synthesis.`,
    briefSummary: `${headline} (AI synthesis unavailable — deterministic evidence only.)`,
    suggestedFollowUp:
      input.computedOverall === "low"
        ? null
        : "Review the per-layer evidence with your clinical team; functional or segregation data would firm up the call.",
    whatWouldChangeThis:
      input.computedOverall === "high"
        ? null
        : "Stronger functional evidence, additional affected-family segregation, or a ClinVar reclassification.",
    acmgRows: [], // do not fabricate ACMG/AMP mappings without the model
  };
}
