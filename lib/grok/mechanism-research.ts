// Scoped Live Search — research a gene's ESTABLISHED disease mechanism when it
// isn't in the curated reference table. Uses xAI's web_search tool (Responses
// API) so the mechanism gate can be set from real, cited literature instead of
// defaulting to the conservative "unconfirmed" 0.5. Strictly additive: a failed
// or empty search returns found:false (the caller then keeps the cautious
// default) — it never invents a mechanism.

import { callGrokWebSearchJSON, type GrokCitation } from "@/lib/grok/client";
import { GeneMechanismResearchSchema, type GeneMechanismResearch } from "@/lib/grok/schemas";

export async function researchGeneMechanism(input: {
  geneSymbol: string;
  clinicalContext: string;
}): Promise<{ data: GeneMechanismResearch; citations: GrokCitation[] }> {
  const system = `You are researching the ESTABLISHED disease mechanism of a human gene to decide whether a loss-of-function mouse KNOCKOUT can model its disease. Use web search to find authoritative sources (ClinGen gene-disease/dosage curations, OMIM, GeneReviews, recent peer-reviewed literature).

Decide whether the gene's predominant disease mechanism is:
- "LoF"  — loss of function / haploinsufficiency (a knockout IS informative),
- "GoF"  — gain of function / dominant-negative / activating (a knockout CANNOT model it),
- "both" — well-documented LoF and GoF disease, or
- "unknown" — you could not find authoritative information.

Be conservative: if you cannot find authoritative support, set found=false and mechanism="unknown". Do NOT guess. Give a single-sentence rationale citing what you actually found.

Output JSON with EXACTLY these keys:
{
  "mechanism": "LoF" | "GoF" | "both" | "unknown",
  "inheritanceMode": "dominant" | "recessive" | "x-linked" | "both" | "unknown",
  "rationale": "<one sentence>",
  "found": <boolean>
}`;
  const user = `Gene: ${input.geneSymbol}\nClinical context: ${input.clinicalContext}\n\nWhat is this gene's established disease mechanism (LoF vs GoF) for variant interpretation?`;

  return callGrokWebSearchJSON(system, user, GeneMechanismResearchSchema, {
    label: "mech-research",
    reasoningEffort: "low",
    maxTokens: 500,
  });
}
