// ─────────────────────────────────────────────────────────────────────────────
// VUS Resolver — SHARED CONTRACT
//
// This file is the integration seam between Person A (research engine / this
// half) and Person B (Next.js app, UI, voice). The shapes below match the
// "Shared Contract" section of both build plans and the v2 architecture.
//
// DO NOT change a shape here without flagging it to the other half — every
// drift in this file is a guaranteed merge conflict at integration time.
// ─────────────────────────────────────────────────────────────────────────────

export type ConfidenceLabel = "low" | "moderate" | "high";

/** Which external source a fragment came from. One source can emit multiple
 *  fragments (e.g. MyVariant emits ClinVar + gnomAD-freq + dbNSFP separately),
 *  disambiguated by the stable `id`. */
export type EvidenceSource =
  | "ensembl_vep"          // Step 0 — consequence type (router)
  | "gnomad_constraint"    // Step 1 — gene-level LOEUF / pLI / mis-z
  | "myvariant"            // Step 2 — ClinVar status, gnomAD freq, dbNSFP bundle
  | "ensembl_conservation" // Step 2 — per-residue / element conservation
  | "ensembl_diopt"        // Step 4 — ortholog identity + DIOPT confidence rank
  | "impc"                 // Step 4 — zygosity-matched KO phenotype + viability
  | "monarch_phenodigm";   // Step 4 — MP↔HPO similarity

/** One piece of evidence retrieved from one external source.
 *  A failed/empty *real* query is a valid fragment with `found: false` — NOT an
 *  error. Connectors only throw when the HTTP call itself fails. */
export type EvidenceFragment = {
  id: string; // stable per-fragment id, e.g. "step2-myvariant-clinvar"
  source: EvidenceSource;
  step: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  queryTime: string; // ISO timestamp
  found: boolean;
  summary: string; // one-line, human-readable — this is what the card renders
  raw: Record<string, unknown>; // original API response slice, for citation/audit
  relevance?: "high" | "medium" | "low" | "unscored";
};

/** The four-layer confidence pipeline + overall. The mechanism gate is a
 *  multiplier in [0,1], not an additive label term — hence its distinct shape. */
export type ConfidencePipelineState = {
  genePrior: { value: number; label: ConfidenceLabel; reason: string } | null;
  variantEffect: { value: number; label: ConfidenceLabel; reason: string } | null;
  mechanismGate: { value: number /* 0..1 */; reason: string } | null;
  crossSpecies: { value: number; label: ConfidenceLabel; reason: string } | null;
  overall: { label: ConfidenceLabel; reason: string } | null;
};

/** Events published to the per-run Inngest Realtime channel `vus-run-${runId}`
 *  (topic: "events"). The frontend subscribes and renders incrementally.
 *  A later `fragment` event with the same `id` is an UPDATE, not a duplicate
 *  (this is how IMPC fragments get their `relevance` filled in after Step 5). */
export type RealtimeEvent =
  | { type: "fragment"; data: EvidenceFragment }
  | { type: "narration"; data: string } // Grok's spoken-aloud commentary
  | { type: "pipeline_update"; data: ConfidencePipelineState }
  | { type: "complete"; briefUrl: string };

// ─── Triggering event ────────────────────────────────────────────────────────

export type EvidenceRequestedData = {
  runId: string;
  variant: string; // HGVS notation or rsID
  clinicalContext: string; // panel-type / free text, maps to HPO terms
};

// ─── Output artifacts (written on completion, read by /brief/[runId]) ─────────

export type AcmgRow = {
  code: string; // e.g. "PP3", "PS3_supporting", "PM2", "BP4"
  direction: "pathogenic" | "benign";
  strength: string; // "supporting" | "moderate" | "strong" | "very strong" | "stand-alone"
  fact: string; // the supporting evidence sentence
  caveat?: string; // verbatim caveat text (e.g. the PS3-framing note for model-organism evidence)
};

export type EvidenceCard = {
  runId: string;
  variant: string;
  geneSymbol: string;
  clinicalContext: string;
  fragments: EvidenceFragment[];
  pipeline: ConfidencePipelineState;
  plainLanguageSummary: string;
  predictorAgreement: string | null; // note on in-silico predictor (dis)agreement
  lethalitySignal: string | null; // note when IMPC viability=lethal was used as an essentiality signal
  generatedAt: string;
};

export type DoctorBrief = {
  runId: string;
  variant: string;
  geneSymbol: string;
  clinicalContext: string;
  overall: ConfidenceLabel;
  summary: string; // plain-language
  perLayerReasons: {
    genePrior: string;
    variantEffect: string;
    mechanismGate: string;
    crossSpecies: string;
  };
  acmgRows: AcmgRow[];
  whatWouldChangeThis: string | null; // present when confidence is not "high"
  suggestedFollowUp: string | null; // null when confidence too low to suggest anything specific
  generatedAt: string;
};

/** What an Inngest step writes on completion; what `/api/brief/[runId]` returns. */
export type RunOutput = {
  evidenceCard: EvidenceCard;
  doctorBrief: DoctorBrief;
};
