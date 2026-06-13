// Barrel export for the Grok reasoning layer.

export {
  callGrokText,
  callGrokJSON,
  callGrokWebSearchJSON,
  type GrokOpts,
  type GrokCitation,
} from "@/lib/grok/client";
export { researchGeneMechanism } from "@/lib/grok/mechanism-research";
export { predictorLeadership } from "@/lib/grok/predictor-leadership";
export { mechanismGate } from "@/lib/grok/mechanism-gate";
export { crossSpeciesCheck } from "@/lib/grok/cross-species";
export { synthesis } from "@/lib/grok/synthesis";
export { patientSummary } from "@/lib/grok/patient-summary";
export { narrate, answerFollowUp } from "@/lib/grok/narration";
export * from "@/lib/grok/schemas";
