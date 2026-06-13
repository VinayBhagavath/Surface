// Grok call #5 — the patient-facing summary.
// Turns the completed investigation into something a patient with NO biology
// background can read: what their uncertain variant is, what the agent resolved
// it to, and a single line on what it means for a CRISPR / gene-therapy plan.
// Grounded strictly in the run's real output (no invented findings).

import { z } from "zod";
import { callGrokJSON } from "@/lib/grok/client";
import type { LiteraturePaper } from "@/lib/connectors/literature";
import type { RunOutput } from "@/lib/types";

export const PatientSummaryGrokSchema = z.object({
  verdict: z.string(), // 2-4 words, e.g. "Likely important"
  headline: z.string(), // one plain sentence
  body: z.array(z.string()).min(1).max(3), // 1-3 simple sentences
  mouseLine: z.string().nullable(), // what the mouse research added (or null)
  therapyNote: z.string(), // ONE line: meaning for their CRISPR / gene-therapy operation
  nextStep: z.string(), // what to do next (doctor-led)
});
export type PatientSummaryGrok = z.infer<typeof PatientSummaryGrokSchema>;

export async function patientSummary(
  output: RunOutput,
  literature: LiteraturePaper[] = [],
): Promise<PatientSummaryGrok> {
  const { evidenceCard: card, doctorBrief: brief } = output;
  const gate = card.pipeline.mechanismGate;
  const cross = card.pipeline.crossSpecies;

  const system = `You explain a genetic "variant of uncertain significance" (VUS) result to a patient who has NO biology background and is preparing for a CRISPR or gene-therapy operation. Use warm, plain, everyday language. NO jargon (no "missense", "allele", "ortholog", "LOEUF"). Never invent findings or numbers — use only what is given.

You are also given a short list of REAL published research papers (titles + journals) found for this gene and condition. You may use them to ground your wording (e.g. "this gene is well studied for this condition"), but do NOT fabricate their contents or cite specific claims you cannot see — only their existence/topic is known to you.

Write:
- verdict: 2-4 words capturing the result ("Likely important", "Possibly important", "Still unclear").
- headline: ONE plain sentence saying, in lay terms, what this DNA change is and what the investigation resolved it to.
- body: 1-3 short, simple sentences explaining WHY (what lines of evidence agreed or didn't). Plain words only.
- mouseLine: ONE plain sentence on what studying the same gene in mice added — or null if mouse data didn't contribute.
- therapyNote: ONE sentence on what this means for the patient as they go into their CRISPR / gene-therapy operation (e.g. whether this change is a confirmed target to act on, or not yet proven enough to treat as the target). Be careful and honest; the doctor decides.
- nextStep: ONE sentence on the practical next step, always framing the doctor / genetic counselor as the decision-maker.

The overall confidence "${brief.overall}" is FIXED — explain it, never contradict it.

Output JSON with EXACTLY these keys:
{
  "verdict": "<2-4 words>",
  "headline": "<one sentence>",
  "body": ["<sentence>", "..."],
  "mouseLine": "<one sentence>" | null,
  "therapyNote": "<one sentence>",
  "nextStep": "<one sentence>"
}`;

  const user = JSON.stringify(
    {
      gene: card.geneSymbol,
      variant: card.variant,
      whatTheyreTestedFor: card.clinicalContext,
      overallConfidence: brief.overall,
      plainLanguageFindings: card.plainLanguageSummary,
      clinicianSummary: brief.summary,
      mechanismGate: gate ? { multiplier: gate.value, reason: gate.reason } : null,
      crossSpeciesEvidence: cross ? { strength: cross.label, reason: cross.reason } : null,
      whatWouldChangeThis: brief.whatWouldChangeThis,
      researchPapersFound: literature.map((p) => ({
        title: p.title,
        journal: p.journal,
        year: p.year,
      })),
    },
    null,
    2,
  );

  return callGrokJSON(system, user, PatientSummaryGrokSchema, { maxTokens: 700 });
}
