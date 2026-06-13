// Server Action: answer a patient/clinician follow-up about the current run using Grok,
// grounded ONLY in the gathered evidence + confidence pipeline. Returns a result object
// (never throws) so the voice layer degrades to text gracefully when the key is missing
// or the API errors.
"use server";

import { generateText } from "ai";
import { createXai } from "@ai-sdk/xai";

const GROK_MODEL = "grok-3"; // follow-up reasoning; change tier here if the key requires it

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
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false, reason: "Voice Q&A is off — no XAI_API_KEY set." };
  const q = question.trim();
  if (!q) return { ok: false, reason: "No question heard." };

  try {
    const xai = createXai({ apiKey });
    const { text } = await generateText({
      model: xai(GROK_MODEL),
      system:
        "You are a clinical-genetics assistant explaining a variant analysis to a patient or clinician. " +
        "Answer ONLY from the evidence and confidence pipeline provided below. Be concise (2-4 sentences), " +
        "plain-language, and honest about uncertainty. Never invent facts or numbers not present in the context.",
      prompt:
        `Variant: ${ctx.geneSymbol} ${ctx.variant} — clinical context: ${ctx.clinicalContext}.\n` +
        `Overall confidence: ${ctx.overall ?? "still resolving"}.\n` +
        `Confidence pipeline: ${ctx.pipelineSummary}\n` +
        `Evidence gathered:\n${ctx.evidence.map((e) => `- ${e}`).join("\n")}\n\n` +
        `Question: ${q}`,
    });
    const answer = text.trim();
    return answer
      ? { ok: true, answer }
      : { ok: false, reason: "Grok returned an empty answer." };
  } catch {
    return { ok: false, reason: "Couldn't reach Grok for the follow-up." };
  }
}
