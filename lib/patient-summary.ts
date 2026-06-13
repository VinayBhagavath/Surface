// Plain-language patient summary — shared types + helpers.
//
// The prose itself is written LIVE by Grok (lib/grok/patient-summary, invoked
// from app/actions/patient-summary) grounded in the real run output + real
// literature. There is no deterministic/templated fallback: if Grok or the run
// output is unavailable, the UI shows an honest error rather than fake text.

import type { ConfidenceLabel } from "@/lib/types";
import { CLINICAL_CONTEXT_OPTIONS } from "@/lib/clinical-context-options";

export type SummaryReference = {
  title: string;
  journal: string | null;
  year: string | null;
  url: string | null;
};

export type PatientSummary = {
  confidence: ConfidenceLabel;
  /** 2-4 word verdict chip, e.g. "Likely important". */
  verdict: string;
  /** One-sentence headline in plain words. */
  headline: string;
  /** Short plain-language sentences expanding the headline. */
  body: string[];
  /** What the mouse research contributed, in plain words (or null if N/A). */
  mouseLine: string | null;
  /** One-liner: what this result means for the patient's CRISPR / gene-therapy plan. */
  therapyNote: string;
  /** What to do next — always frames the doctor as the decision-maker. */
  nextStep: string;
  /** Real published papers the result is grounded in (Europe PMC). */
  references: SummaryReference[];
  /** Always "grok" — the summary is written live by the model. */
  source: "grok";
};

/** Plain condition phrase for the literature query / display (no jargon). */
export function plainContextLabel(key: string): string {
  const found = CLINICAL_CONTEXT_OPTIONS.find((o) => o.value === key);
  const raw = found?.label ?? key.replace(/_/g, " ");
  return raw.split(/[/(]/)[0].trim().toLowerCase();
}
