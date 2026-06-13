// Layered confidence model — PURE function, no API calls, unit-tested.
//
//   gene_prior        = f(LOEUF, pLI, missense-z)
//   variant_effect    = f(headline predictor, predictor agreement, conservation)
//   mechanism_gate    = Grok gate in [0,1]              (a MULTIPLIER, not a term)
//   cross_species_raw = f(ortholog quality, phenotype relevance, lethality, monarch)
//   cross_species     = mechanism_gate * cross_species_raw     (gated)
//   overall           = combine(gene_prior, variant_effect, cross_species)
//
// The mechanism gate is what makes a dramatic-but-irrelevant mouse phenotype
// (e.g. a GoF gene's lethal knockout) correctly stop counting.

import type { ConfidenceLabel, ConfidencePipelineState } from "@/lib/types";

export type LayeredConfidenceInput = {
  genePrior: { loeuf: number | null; pli: number | null; misZ: number | null } | null;
  variantEffect: {
    direction: "deleterious" | "benign" | "uncertain";
    agreement: "agree" | "mixed" | "disagree";
    alphamissense: number | null;
    revel: number | null;
    cadd: number | null;
    conservationSupport: "supports" | "neutral" | "undercuts";
    headlinePredictor: string;
  } | null;
  mechanismGate: { value: number; reason: string } | null;
  crossSpecies: {
    orthologQuality: "high" | "moderate" | "low" | null;
    monarchSimilarity: number | null; // IC score
    lethal: boolean;
    maxRelevance: "high" | "medium" | "low" | null; // Grok-assigned best phenotype relevance
    strength: "low" | "moderate" | "high" | null; // Grok's holistic crossSpeciesStrength
    found: boolean;
  } | null;
};

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const HIGH = 0.66;
const MODERATE = 0.4;

function label(v: number): ConfidenceLabel {
  return v >= HIGH ? "high" : v >= MODERATE ? "moderate" : "low";
}
const fmt = (n: number | null, d = 2) => (n === null ? "n/a" : n.toFixed(d));

// ── Gene prior ────────────────────────────────────────────────────────────────

function genePriorScore(p: NonNullable<LayeredConfidenceInput["genePrior"]>): number {
  const loeufScore =
    p.loeuf === null ? 0.4 : p.loeuf < 0.35 ? 1.0 : p.loeuf < 0.6 ? 0.8 : p.loeuf < 1.0 ? 0.5 : 0.25;
  const pliScore = p.pli === null ? 0.4 : p.pli >= 0.9 ? 1.0 : p.pli >= 0.5 ? 0.7 : 0.3;
  const misZScore = p.misZ === null ? 0.4 : p.misZ >= 3 ? 1.0 : p.misZ >= 2 ? 0.7 : p.misZ >= 1 ? 0.5 : 0.3;
  const lofSignal = Math.max(loeufScore, pliScore);
  return clamp(0.6 * lofSignal + 0.4 * misZScore);
}

// ── Variant effect ──────────────────────────────────────────────────────────

function predictorMagnitude(v: NonNullable<LayeredConfidenceInput["variantEffect"]>): number {
  if (v.alphamissense !== null) {
    const s = v.alphamissense;
    return s >= 0.9 ? 0.95 : s >= 0.7 ? 0.82 : s >= 0.564 ? 0.66 : s > 0.34 ? 0.45 : 0.15;
  }
  if (v.cadd !== null) {
    const c = v.cadd;
    return c >= 30 ? 0.9 : c >= 25 ? 0.8 : c >= 20 ? 0.6 : c >= 15 ? 0.45 : 0.25;
  }
  if (v.revel !== null) {
    const r = v.revel;
    return r >= 0.9 ? 0.9 : r >= 0.7 ? 0.75 : r >= 0.5 ? 0.55 : r >= 0.3 ? 0.4 : 0.2;
  }
  return 0.4;
}

function variantEffectScore(v: NonNullable<LayeredConfidenceInput["variantEffect"]>): number {
  let s = predictorMagnitude(v);
  // disagreement pulls toward "uncertain" (0.5); mild for mixed, strong for disagree
  if (v.agreement === "mixed") s += (0.5 - s) * 0.25;
  if (v.agreement === "disagree") s += (0.5 - s) * 0.5;
  if (v.conservationSupport === "supports") s += 0.08;
  if (v.conservationSupport === "undercuts") s -= 0.12;
  return clamp(s);
}

// ── Cross-species (raw, before gating) ──────────────────────────────────────

function crossSpeciesRaw(c: NonNullable<LayeredConfidenceInput["crossSpecies"]>): number {
  if (!c.found && !c.lethal) return 0.1;
  const orthologScore =
    c.orthologQuality === "high" ? 1.0 : c.orthologQuality === "moderate" ? 0.6 : c.orthologQuality === "low" ? 0.3 : 0.2;
  const phenotypeScore =
    c.maxRelevance === "high" ? 1.0 : c.maxRelevance === "medium" ? 0.6 : c.maxRelevance === "low" ? 0.25 : c.found ? 0.3 : 0.0;
  const strengthScore = c.strength === "high" ? 1.0 : c.strength === "moderate" ? 0.6 : c.strength === "low" ? 0.25 : 0.4;

  let raw = 0.4 * phenotypeScore + 0.35 * strengthScore + 0.25 * orthologScore;
  if (c.monarchSimilarity !== null) {
    const m = c.monarchSimilarity;
    const monarchScore = m >= 10 ? 1.0 : m >= 6 ? 0.7 : m >= 3 ? 0.45 : m > 0 ? 0.3 : 0.2;
    raw = raw * 0.85 + monarchScore * 0.15;
  }
  if (c.lethal) raw = Math.max(raw, 0.6); // essentiality floor (lethality is high-weight)
  return clamp(raw);
}

// ── Combine ──────────────────────────────────────────────────────────────────

export function computeLayeredConfidence(input: LayeredConfidenceInput): ConfidencePipelineState {
  // gene prior
  const genePrior = input.genePrior
    ? (() => {
        const v = genePriorScore(input.genePrior);
        return {
          value: round(v),
          label: label(v),
          reason: `Gene constraint: LOEUF ${fmt(input.genePrior.loeuf)}, pLI ${fmt(input.genePrior.pli)}, missense-z ${fmt(input.genePrior.misZ)} → ${label(v)} prior that variation in this gene matters.`,
        };
      })()
    : null;

  // variant effect
  const variantEffect = input.variantEffect
    ? (() => {
        const v = variantEffectScore(input.variantEffect);
        const agree =
          input.variantEffect!.agreement === "agree"
            ? "predictors agree"
            : input.variantEffect!.agreement === "mixed"
              ? "predictors are mixed"
              : "predictors DISAGREE";
        return {
          value: round(v),
          label: label(v),
          reason: `${input.variantEffect!.headlinePredictor} headline, ${agree}, conservation ${input.variantEffect!.conservationSupport} → ${label(v)} variant-effect evidence.`,
        };
      })()
    : null;

  // mechanism gate
  const mechanismGate = input.mechanismGate
    ? { value: round(input.mechanismGate.value), reason: input.mechanismGate.reason }
    : null;

  // cross species (gated)
  let crossSpecies: ConfidencePipelineState["crossSpecies"] = null;
  if (input.crossSpecies) {
    const raw = crossSpeciesRaw(input.crossSpecies);
    const gate = mechanismGate?.value ?? 1;
    const gated = clamp(raw * gate);
    const suppressed = gate < 0.4 && raw >= 0.5;
    crossSpecies = {
      value: round(gated),
      label: label(gated),
      reason: suppressed
        ? `Raw cross-species evidence was ${label(raw)} (${round(raw)}), but the mechanism gate (${round(gate)}) suppressed it — a knockout cannot model this gene's disease mechanism, so the mouse data does not count toward confidence.`
        : `Ortholog ${input.crossSpecies.orthologQuality ?? "n/a"}, best phenotype relevance ${input.crossSpecies.maxRelevance ?? "n/a"}${input.crossSpecies.lethal ? ", knockout lethal (essentiality)" : ""} → cross-species ${label(gated)} after gating (raw ${round(raw)} × gate ${round(gate)}).`,
    };
  }

  // overall
  let overall: ConfidencePipelineState["overall"] = null;
  const present = [genePrior?.value, variantEffect?.value, crossSpecies?.value].filter(
    (x): x is number => typeof x === "number",
  );
  if (present.length) {
    const gp = genePrior?.value ?? 0.4;
    const ve = variantEffect?.value ?? 0.4;
    const cs = crossSpecies?.value ?? 0.2;
    const overallValue = clamp(0.25 * gp + 0.4 * ve + 0.35 * cs);
    const lab = label(overallValue);
    const gateSuppressed = (mechanismGate?.value ?? 1) < 0.4 && input.crossSpecies && crossSpeciesRaw(input.crossSpecies) >= 0.5;
    overall = {
      label: lab,
      reason:
        `Overall ${lab} (gene-prior ${gp.toFixed(2)}, variant-effect ${ve.toFixed(2)}, cross-species ${cs.toFixed(2)}). ` +
        (gateSuppressed
          ? `The confidence you see comes from the human-side evidence; the mouse evidence was gated out because the disease mechanism is not one a knockout can model.`
          : lab === "low"
            ? `Not yet strong enough to act on.`
            : `Convergent evidence supports this rating.`),
    };
  }

  return { genePrior, variantEffect, mechanismGate, crossSpecies, overall };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
