// Grok call #4 (Step 6) — layered synthesis + ACMG/AMP mapping.
// Writes the Evidence Card narrative + Doctor Brief prose and maps the gathered
// evidence onto ACMG/AMP codes. The OVERALL rating is the deterministic
// confidence model's output (passed in) — Grok explains it, it does not
// override it. Model-organism functional evidence is forced to PS3_supporting
// with the verbatim caveat in post-processing.

import { callGrokJSON } from "@/lib/grok/client";
import { SynthesisSchema, type Synthesis } from "@/lib/grok/schemas";
import { ACMG_CODES } from "@/lib/reference/acmg";
import type { ConfidenceLabel, ConfidencePipelineState } from "@/lib/types";

const ACMG_REFERENCE = Object.entries(ACMG_CODES)
  .map(([code, c]) => `${code} (${c.direction}, ${c.defaultStrength}): ${c.description}`)
  .join("\n");

export async function synthesis(input: {
  geneSymbol: string;
  variant: string;
  proteinChange: string | null;
  clinicalContext: string;
  computedOverall: ConfidenceLabel;
  pipeline: ConfidencePipelineState;
  trajectory: string[]; // ordered fragment summaries
  predictorAgreement: string | null;
  lethalitySignal: string | null;
  mechanism: { mechanism: string; inheritanceMode: string; notes: string } | null;
}): Promise<Synthesis> {
  const system = `You are writing the final synthesis for a Variant of Uncertain Significance (VUS) investigation that a patient will bring to their doctor. You are given the full evidence trajectory and a COMPUTED overall confidence rating from a deterministic layered model.

IMPORTANT: the overall rating ("${input.computedOverall}") is fixed — explain it, do not contradict it. Your job is the prose + the ACMG/AMP mapping.

Write:
- plainLanguageSummary: 3-5 sentences, plain language, what was found across human + cross-species evidence and WHY the confidence is what it is. Mention explicitly when the mechanism gate suppressed the mouse evidence, if it did.
- briefSummary: a tighter clinician-facing version (2-3 sentences).
- suggestedFollowUp: a specific next step (e.g. a functional assay, segregation study, or specialist referral) — but set it to null if the overall rating is "low" (not yet strong enough to suggest anything specific).
- whatWouldChangeThis: what additional evidence would move the confidence — set to null only if overall is "high".
- acmgRows: map the gathered evidence onto ACMG/AMP 2015 codes using ONLY codes from this reference list. For any mouse / model-organism functional evidence, use the code "PS3_supporting" (supporting strength). Each row: {code, direction: "pathogenic"|"benign", strength, fact}.

ACMG/AMP code reference:
${ACMG_REFERENCE}

Be honest and non-generic. Ground every statement in the provided trajectory.

Output JSON with EXACTLY these keys:
{
  "overallReason": "<string explaining the computed overall rating>",
  "plainLanguageSummary": "<3-5 sentence string>",
  "briefSummary": "<2-3 sentence clinician-facing string>",
  "suggestedFollowUp": "<string>" | null,
  "whatWouldChangeThis": "<string>" | null,
  "acmgRows": [ { "code": "<ACMG code>", "direction": "pathogenic" | "benign", "strength": "<supporting|moderate|strong|very strong|stand-alone>", "fact": "<evidence sentence>" } ]
}`;

  const user = JSON.stringify(
    {
      variant: input.variant,
      gene: input.geneSymbol,
      proteinChange: input.proteinChange,
      clinicalContext: input.clinicalContext,
      computedOverall: input.computedOverall,
      confidencePipeline: input.pipeline,
      predictorAgreement: input.predictorAgreement,
      lethalitySignal: input.lethalitySignal,
      geneMechanism: input.mechanism,
      evidenceTrajectory: input.trajectory,
    },
    null,
    2,
  );

  return callGrokJSON(system, user, SynthesisSchema, {
    maxTokens: 1600,
    label: "synthesis",
    // Reasoning, but kept low to favour responsiveness (it writes from given data).
    reasoningEffort: "low",
  });
}
