import { describe, it, expect } from "vitest";
import {
  PredictorLeadershipSchema,
  MechanismGateSchema,
  CrossSpeciesSchema,
  SynthesisSchema,
} from "@/lib/grok/schemas";
import {
  predictorLeadershipFallback,
  mechanismGateFallback,
  crossSpeciesFallback,
  synthesisFallback,
  GROK_UNAVAILABLE_NOTE,
} from "@/lib/grok/fallbacks";
import type { ConfidencePipelineState } from "@/lib/types";

// These prove the degradation path: when a Grok reasoning call ultimately fails,
// the pipeline substitutes a schema-VALID, honest object so the run still
// produces a rendered brief instead of crashing.

describe("grok degradation fallbacks", () => {
  it("predictor fallback is schema-valid and infers direction from real scores", () => {
    const r = predictorLeadershipFallback({
      consequenceClass: "missense_variant",
      alphamissense: { score: 0.98, label: "likely_pathogenic" },
      revel: 0.9,
      cadd: 30,
      conservation: { gerp: 5, phyloP: 3 },
    });
    expect(() => PredictorLeadershipSchema.parse(r)).not.toThrow();
    expect(r.direction).toBe("deleterious");
    expect(r.conservationSupport).toBe("supports");
    expect(r.interpretation).toContain(GROK_UNAVAILABLE_NOTE);
  });

  it("predictor fallback calls a benign AlphaMissense score benign", () => {
    const r = predictorLeadershipFallback({
      consequenceClass: "missense_variant",
      alphamissense: { score: 0.1, label: "likely_benign" },
      revel: null,
      cadd: null,
      conservation: { gerp: -1, phyloP: null },
    });
    expect(r.direction).toBe("benign");
    expect(r.conservationSupport).toBe("undercuts");
  });

  it("mechanism-gate fallback is the conservative 0.5, never 1.0", () => {
    const r = mechanismGateFallback();
    expect(() => MechanismGateSchema.parse(r)).not.toThrow();
    expect(r.gate).toBe(0.5);
    expect(r.gate).not.toBe(1);
    expect(r.mouseInformative).toBe(false);
    expect(r.reason.toLowerCase()).toContain("unconfirmed");
  });

  it("cross-species fallback is schema-valid and honest about insufficiency", () => {
    const r = crossSpeciesFallback({ monarchSimilarity: 3, lethal: false, anyImpcFound: true });
    expect(() => CrossSpeciesSchema.parse(r)).not.toThrow();
    expect(r.verdict).toBe("insufficient");
    expect(r.relevanceById).toEqual({});
    expect(r.crossSpeciesStrength).toBe("low");
  });

  it("cross-species fallback treats knockout lethality as a handled signal", () => {
    const r = crossSpeciesFallback({ monarchSimilarity: null, lethal: true, anyImpcFound: true });
    expect(r.lethalityHandled).toBe(true);
    expect(r.crossSpeciesStrength).toBe("moderate");
  });

  it("synthesis fallback is schema-valid and labels itself deterministic-only", () => {
    const pipeline: ConfidencePipelineState = {
      genePrior: { value: 0.3, label: "low", reason: "x" },
      variantEffect: { value: 0.8, label: "high", reason: "y" },
      mechanismGate: { value: 0.5, reason: "z" },
      crossSpecies: { value: 0.6, label: "moderate", reason: "w" },
      overall: { label: "moderate", reason: "o" },
    };
    const r = synthesisFallback({
      geneSymbol: "BRCA1",
      variant: "rs80357064",
      clinicalContext: "breast cancer",
      computedOverall: "moderate",
      pipeline,
    });
    expect(() => SynthesisSchema.parse(r)).not.toThrow();
    expect(r.acmgRows).toEqual([]); // never fabricate ACMG codes without the model
    expect(r.plainLanguageSummary).toContain(GROK_UNAVAILABLE_NOTE);
  });
});
