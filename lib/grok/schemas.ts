// Zod schemas for every Grok structured output. Validating the model's JSON
// keeps the pipeline from propagating malformed reasoning downstream.

import { z } from "zod";

export const PredictorLeadershipSchema = z.object({
  headlinePredictor: z.string(),
  headlineValue: z.string(),
  direction: z.enum(["deleterious", "benign", "uncertain"]),
  agreement: z.enum(["agree", "mixed", "disagree"]),
  disagreementNote: z.string().nullable(),
  conservationSupport: z.enum(["supports", "neutral", "undercuts"]),
  interpretation: z.string(),
});
export type PredictorLeadership = z.infer<typeof PredictorLeadershipSchema>;

export const MechanismGateSchema = z.object({
  gate: z.number().min(0).max(1),
  mouseInformative: z.boolean(),
  reason: z.string(),
});
export type MechanismGate = z.infer<typeof MechanismGateSchema>;

export const CrossSpeciesSchema = z.object({
  verdict: z.enum(["confirmed", "qualified", "refuted", "insufficient"]),
  crossSpeciesStrength: z.enum(["low", "moderate", "high"]),
  lethalityHandled: z.boolean(),
  narration: z.string(),
  relevanceById: z.record(z.string(), z.enum(["high", "medium", "low"])),
});
export type CrossSpecies = z.infer<typeof CrossSpeciesSchema>;

export const AcmgRowSchema = z.object({
  code: z.string(),
  direction: z.enum(["pathogenic", "benign"]),
  strength: z.string(),
  fact: z.string(),
});

export const SynthesisSchema = z.object({
  overallReason: z.string(),
  plainLanguageSummary: z.string(),
  briefSummary: z.string(),
  suggestedFollowUp: z.string().nullable(),
  whatWouldChangeThis: z.string().nullable(),
  acmgRows: z.array(AcmgRowSchema),
});
export type Synthesis = z.infer<typeof SynthesisSchema>;
