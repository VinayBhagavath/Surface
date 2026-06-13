// Grok call #5 — narration wrapper + follow-up Q&A.
// narrate() turns a templated fact into one warm spoken-aloud line. The main
// pipeline mostly derives narration from the reasoning calls' own outputs (to
// keep the call count to four reasoning calls per run), so narrate() is used
// sparingly for templated steps and is available to Person B for the voice
// follow-up flow.

import { callGrokText } from "@/lib/grok/client";

export async function narrate(fact: string): Promise<string> {
  const system = `Turn the given evidence note into ONE warm, plain, spoken-aloud sentence for a patient. No unexplained jargon. Do not add facts. Max two sentences.`;
  return callGrokText(system, fact, { temperature: 0.5, maxTokens: 160 });
}

/** Answer a patient follow-up grounded ONLY in the supplied trajectory + gate
 *  reasoning. Person B can call this from the voice pane; no re-querying needed
 *  because the gate's stated reason is already in context. */
export async function answerFollowUp(input: {
  question: string;
  geneSymbol: string;
  clinicalContext: string;
  contextSummary: string; // trajectory + gate reason + overall, as text
}): Promise<string> {
  const system = `You are the patient-facing voice of a VUS investigation. Answer the patient's question using ONLY the evidence context provided — do not invent new findings. Be warm, plain, and concise (2-4 sentences). If the answer isn't in the context, say so honestly and suggest who could answer it.`;
  const user = `Patient question: ${input.question}\n\nEvidence context for ${input.geneSymbol} (clinical context: ${input.clinicalContext}):\n${input.contextSummary}`;
  return callGrokText(system, user, { temperature: 0.5, maxTokens: 350 });
}
