// Server Action: produce the final patient-facing summary with Grok, grounded
// strictly in the LIVE run's real stored output. No demo data, no deterministic
// fallback — if the run output isn't available or Grok fails, this throws and
// the UI shows an honest error/retry. Literature grounding is a real Europe PMC
// query.

"use server";

import { getOutput } from "@/lib/store";
import { patientSummary as grokPatientSummary } from "@/lib/grok/patient-summary";
import {
  plainContextLabel,
  type PatientSummary,
  type SummaryReference,
} from "@/lib/patient-summary";
import { searchLiterature, type LiteraturePaper } from "@/lib/connectors/literature";
import type { RunOutput } from "@/lib/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Read the live run output, with a short retry to cover the tiny race between
 *  the realtime `complete` event and the stored output being readable. */
async function loadOutput(runId: string): Promise<RunOutput> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const out = await getOutput(runId);
    if (out) return out;
    await sleep(500 * (attempt + 1));
  }
  throw new Error(`No stored output for run ${runId} yet.`);
}

function toReferences(papers: LiteraturePaper[]): SummaryReference[] {
  return papers.map((p) => ({ title: p.title, journal: p.journal, year: p.year, url: p.url }));
}

export async function summarizeForPatient(input: { runId: string }): Promise<PatientSummary> {
  const output = await loadOutput(input.runId);

  // Real scholarly-literature pass (Europe PMC) for grounding + display.
  const lit = await searchLiterature({
    geneSymbol: output.evidenceCard.geneSymbol,
    condition: plainContextLabel(output.evidenceCard.clinicalContext),
    limit: 4,
  });

  // Grok writes the plain-language summary, grounded in the run + the papers.
  const g = await grokPatientSummary(output, lit.papers);
  return {
    confidence: output.doctorBrief.overall,
    verdict: g.verdict,
    headline: g.headline,
    body: g.body,
    mouseLine: g.mouseLine,
    therapyNote: g.therapyNote,
    nextStep: g.nextStep,
    references: toReferences(lit.papers),
    source: "grok",
  };
}
