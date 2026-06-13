// Grok call #1 (Step 2) — predictor leadership + disagreement flagging.
// Narrow: only the consequence type, predictor scores, and conservation.

import { callGrokJSON } from "@/lib/grok/client";
import { PredictorLeadershipSchema, type PredictorLeadership } from "@/lib/grok/schemas";

export async function predictorLeadership(input: {
  geneSymbol: string;
  consequenceClass: string;
  alphamissense: { score: number | null; label: string | null };
  revel: number | null;
  cadd: number | null;
  spliceaiMax: number | null;
  sift: string | null;
  polyphen: string | null;
  conservation: { elementScore: number | null; gerp: number | null; phyloP: number | null };
}): Promise<PredictorLeadership> {
  const system = `You are a clinical variant-interpretation assistant. You are given a variant's consequence type, its in-silico predictor scores, and per-residue conservation. Decide which predictor is the appropriate HEADLINE number for THIS consequence type:
- missense -> AlphaMissense is the headline (REVEL / CADD / EVE are secondary)
- splice or splice-region -> the SpliceAI delta is the headline
- otherwise -> CADD as a general deleteriousness proxy.

State whether the predictors AGREE on direction. If they DISAGREE, surface that explicitly in disagreementNote — do NOT silently resolve it, because predictor disagreement is itself meaningful information for a clinician. Judge whether conservation supports, is neutral to, or undercuts a deleterious call (high GERP++/phyloP or a strong constrained element supports it). Keep interpretation to one clinical sentence.

Output JSON with EXACTLY these keys and allowed values:
{
  "headlinePredictor": "<string, e.g. AlphaMissense>",
  "headlineValue": "<string, e.g. 0.99 (likely pathogenic)>",
  "direction": "deleterious" | "benign" | "uncertain",
  "agreement": "agree" | "mixed" | "disagree",
  "disagreementNote": "<string>" | null,
  "conservationSupport": "supports" | "neutral" | "undercuts",
  "interpretation": "<one clinical sentence string>"
}`;
  return callGrokJSON(system, JSON.stringify(input, null, 2), PredictorLeadershipSchema, {
    maxTokens: 700,
  });
}
