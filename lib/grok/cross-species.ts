// Grok call #3 (Step 5) — cross-species sanity check.
// Grok is given the ACTUAL MP/HPO term text, not just the Monarch number, and
// asked whether the number reflects a real match or an ontology artifact. It
// also handles lethality-as-signal and assigns relevance to each IMPC fragment
// (folding in the original "relevance filtering" call).

import { callGrokJSON } from "@/lib/grok/client";
import { CrossSpeciesSchema, type CrossSpecies } from "@/lib/grok/schemas";

export async function crossSpeciesCheck(input: {
  geneSymbol: string;
  clinicalContext: string;
  hpoTerms: string[];
  orthologQuality: string | null;
  monarch: {
    found: boolean;
    similarityScore: number | null;
    bestPair: { mpLabel: string; hpoLabel: string } | null;
  };
  impcFragments: { id: string; summary: string; mpTermName: string | null; lethal: boolean }[];
  lethal: boolean;
}): Promise<CrossSpecies> {
  const system = `You are performing the cross-species sanity check. You are given:
- a computed Monarch/Phenodigm similarity NUMBER between mouse knockout phenotypes (MP terms) and the patient's phenotype (HPO terms),
- the ACTUAL mouse phenotype descriptions (IMPC fragments), each with a stable "id",
- the patient's clinical context.

Do NOT trust the number blindly. Read the actual term text and decide whether it reflects a clinically meaningful match or an ontology-structure artifact (a broad MP term can score moderately against a specific HPO term for structural reasons without being meaningful).

Two hard rules:
1) If lethal=true (the knockout is embryonic/preweaning lethal), treat that as a HIGH-confidence ESSENTIALITY signal INDEPENDENT of the Monarch score — never report it as "no similarity". Set lethalityHandled=true.
2) Assign a relevance (high|medium|low) to EVERY IMPC fragment id in relevanceById, based on whether that specific phenotype plausibly relates to the clinical context.

crossSpeciesStrength is YOUR honest read of how strong the mouse->human evidence is BEFORE any mechanism gating (the gate is applied separately downstream — do not pre-apply it here). narration is one short, warm paragraph a patient could understand, e.g. "the computed similarity is X, and looking at the actual terms (mouse: '...'; human: '...') this is a genuinely close match / an ontology artifact".

Output JSON with EXACTLY these keys and allowed values:
{
  "verdict": "confirmed" | "qualified" | "refuted" | "insufficient",
  "crossSpeciesStrength": "low" | "moderate" | "high",
  "lethalityHandled": <boolean>,
  "narration": "<one short paragraph string>",
  "relevanceById": { "<each IMPC fragment id given above>": "high" | "medium" | "low" }
}
relevanceById MUST contain one entry for every IMPC fragment id provided (use {} only if no fragments were given).`;
  return callGrokJSON(system, JSON.stringify(input, null, 2), CrossSpeciesSchema, {
    maxTokens: 900,
  });
}
