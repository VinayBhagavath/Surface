// Server Action: produce the final patient-facing summary with Grok, grounded
// in the run's real output. Returns a structured result (never throws) and
// always degrades gracefully to the deterministic builder when the XAI key is
// missing or the API errors — so the summary ALWAYS renders.

"use server";

import { hasXai } from "@/lib/env";
import { getOutput } from "@/lib/store";
import { patientSummary as grokPatientSummary } from "@/lib/grok/patient-summary";
import {
  buildPatientSummary,
  plainContextLabel,
  type PatientSummary,
  type SummaryReference,
} from "@/lib/patient-summary";
import { searchLiterature, type LiteraturePaper } from "@/lib/connectors/literature";
import { DEMO_OUTPUTS, isDemoId, DEFAULT_DEMO } from "@/fixtures/runs";
import type { RunOutput } from "@/lib/types";

async function resolveOutput(runId?: string, demo?: string): Promise<RunOutput> {
  if (runId) {
    try {
      const live = await getOutput(runId);
      if (live) return live;
    } catch {
      /* fall through to fixture */
    }
  }
  const id = isDemoId(demo) ? demo : DEFAULT_DEMO;
  return DEMO_OUTPUTS[id];
}

function toReferences(papers: LiteraturePaper[]): SummaryReference[] {
  return papers.map((p) => ({
    title: p.title,
    journal: p.journal,
    year: p.year,
    url: p.url,
  }));
}

export async function summarizeForPatient(input: {
  runId?: string;
  demo?: string;
}): Promise<PatientSummary> {
  const output = await resolveOutput(input.runId, input.demo);
  const fallback = buildPatientSummary(output); // deterministic, always valid

  // Real literature pass (Europe PMC). Best-effort: never block the summary.
  let papers: LiteraturePaper[] = [];
  try {
    const lit = await searchLiterature({
      geneSymbol: output.evidenceCard.geneSymbol,
      condition: plainContextLabel(output.evidenceCard.clinicalContext),
      limit: 4,
    });
    papers = lit.papers;
  } catch {
    papers = [];
  }
  const references = toReferences(papers);

  if (!hasXai()) return { ...fallback, references };

  try {
    const g = await grokPatientSummary(output, papers);
    return {
      confidence: output.doctorBrief.overall,
      verdict: g.verdict,
      headline: g.headline,
      body: g.body,
      mouseLine: g.mouseLine,
      therapyNote: g.therapyNote,
      nextStep: g.nextStep,
      references,
      source: "grok",
    };
  } catch {
    return { ...fallback, references };
  }
}
