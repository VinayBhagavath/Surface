// Server Action: answer a patient/clinician follow-up about the current run,
// grounded ONLY in the gathered evidence + confidence pipeline. Routes through
// the ONE canonical Grok client (lib/grok → grok-4.3); no second SDK, no second
// model string. Returns a result object (never throws) so the voice/text layer
// degrades gracefully when the key is missing or the API errors.
"use server";

import { hasXai } from "@/lib/env";
import { answerFollowUp } from "@/lib/grok";

export type FollowupContext = {
  geneSymbol: string;
  variant: string;
  clinicalContext: string;
  overall: string | null;
  pipelineSummary: string;
  evidence: string[];
};

export type FollowupResult =
  | { ok: true; answer: string }
  | { ok: false; reason: string };

export async function askFollowup(
  question: string,
  ctx: FollowupContext,
): Promise<FollowupResult> {
  if (!hasXai()) return { ok: false, reason: "Voice Q&A is off — no XAI_API_KEY set." };
  const q = question.trim();
  if (!q) return { ok: false, reason: "No question heard." };

  // Compose the grounding context answerFollowUp expects (trajectory + gate
  // reason + overall, as text) from the visible run state.
  const contextSummary = [
    `Overall confidence: ${ctx.overall ?? "still resolving"}.`,
    `Confidence pipeline: ${ctx.pipelineSummary}`,
    "Evidence gathered:",
    ...ctx.evidence.map((e) => `- ${e}`),
  ].join("\n");

  try {
    const answer = (
      await answerFollowUp({
        question: q,
        geneSymbol: ctx.geneSymbol,
        clinicalContext: ctx.clinicalContext,
        contextSummary,
      })
    ).trim();
    return answer ? { ok: true, answer } : { ok: false, reason: "Grok returned an empty answer." };
  } catch {
    return { ok: false, reason: "Couldn't reach Grok for the follow-up." };
  }
}
