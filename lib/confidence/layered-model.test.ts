import { describe, expect, it } from "vitest";
import { computeLayeredConfidence, type LayeredConfidenceInput } from "@/lib/confidence/layered-model";

// Shaped after the three real demo variants (see lib/demo-variants.ts).

const ldlrLike: LayeredConfidenceInput = {
  // LoF-tolerant gene (honest: heterozygous LoF common) ...
  genePrior: { loeuf: 1.12, pli: 0.0, misZ: -0.05 },
  // ... but predictors agree deleterious at a conserved residue,
  variantEffect: {
    direction: "deleterious",
    agreement: "agree",
    alphamissense: 0.99,
    revel: 0.97,
    cadd: 29.2,
    conservationSupport: "supports",
    headlinePredictor: "AlphaMissense",
  },
  mechanismGate: { value: 0.95, reason: "LoF gene; knockout is informative." },
  crossSpecies: {
    orthologQuality: "high",
    monarchSimilarity: 15.86,
    lethal: false,
    maxRelevance: "high",
    strength: "high",
    found: true,
  },
};

const gateClosingLike: LayeredConfidenceInput = {
  // Highly constrained gene, strong predictors, conserved ...
  genePrior: { loeuf: 0.18, pli: 1.0, misZ: 9.49 },
  variantEffect: {
    direction: "deleterious",
    agreement: "agree",
    alphamissense: 0.97,
    revel: 0.83,
    cadd: 34,
    conservationSupport: "supports",
    headlinePredictor: "AlphaMissense",
  },
  // ... but the gene is gain-of-function, so the gate is near-closed,
  mechanismGate: { value: 0.1, reason: "GoF gene (Timothy syndrome); a LoF knockout cannot model it." },
  // ... even though the raw cross-species evidence is dramatic (lethal KO).
  crossSpecies: {
    orthologQuality: "high",
    monarchSimilarity: 3.49,
    lethal: true,
    maxRelevance: "low",
    strength: "moderate",
    found: true,
  },
};

const disagreementNoMouseLike: LayeredConfidenceInput = {
  genePrior: { loeuf: 0.86, pli: 0.0, misZ: 2.15 },
  variantEffect: {
    direction: "uncertain",
    agreement: "disagree", // AM benign vs REVEL/CADD leaning pathogenic
    alphamissense: 0.25,
    revel: 0.68,
    cadd: 23.4,
    conservationSupport: "supports",
    headlinePredictor: "AlphaMissense",
  },
  mechanismGate: { value: 0.9, reason: "LoF gene; knockout would be informative." },
  crossSpecies: {
    orthologQuality: "high",
    monarchSimilarity: null,
    lethal: false,
    maxRelevance: null,
    strength: "low",
    found: false, // no significant IMPC phenotype
  },
};

describe("computeLayeredConfidence", () => {
  it("everything-agrees (LDLR-shaped) lands HIGH with a strong cross-species layer", () => {
    const r = computeLayeredConfidence(ldlrLike);
    expect(r.overall?.label).toBe("high");
    expect(r.variantEffect?.label).toBe("high");
    expect(r.crossSpecies && r.crossSpecies.value).toBeGreaterThan(0.7);
    expect(r.mechanismGate?.value).toBeGreaterThan(0.8);
  });

  it("gate-closing (CACNA1C-shaped) SUPPRESSES cross-species despite a dramatic raw signal", () => {
    const r = computeLayeredConfidence(gateClosingLike);
    expect(r.mechanismGate?.value).toBeLessThanOrEqual(0.2);
    // raw cross-species would be >= 0.5 (lethal essentiality floor), but gating crushes it
    expect(r.crossSpecies && r.crossSpecies.value).toBeLessThanOrEqual(0.2);
    expect(r.crossSpecies?.reason.toLowerCase()).toContain("suppress");
    // and the overall reason explains the suppression
    expect(r.overall?.reason.toLowerCase()).toContain("mouse evidence was gated out");
  });

  it("predictor-disagreement + no mouse phenotype lands NOT high, cross-species weak", () => {
    const r = computeLayeredConfidence(disagreementNoMouseLike);
    expect(r.overall?.label).not.toBe("high");
    expect(r.crossSpecies && r.crossSpecies.value).toBeLessThan(0.5);
    expect(r.variantEffect && r.variantEffect.value).toBeLessThan(0.66);
  });

  it("handles missing layers without throwing", () => {
    const r = computeLayeredConfidence({
      genePrior: null,
      variantEffect: null,
      mechanismGate: null,
      crossSpecies: null,
    });
    expect(r.overall).toBeNull();
    expect(r.genePrior).toBeNull();
  });
});
