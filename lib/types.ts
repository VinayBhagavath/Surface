// /lib/types.ts
// SHARED CONTRACT — FROZEN. Identical in Person A's and Person B's work.
// Do NOT add, rename, or reorder any field without a `// CROSS-TEAM:` flag and
// coordinating with Person A first. Merge-critical.

export type EvidenceFragment = {
  id: string;
  source:
    | "ensembl_vep"
    | "gnomad_constraint"
    | "myvariant"
    | "ensembl_conservation"
    | "ensembl_diopt"
    | "impc"
    | "monarch_phenodigm";
  step: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  queryTime: string;
  found: boolean;
  summary: string;            // one-line, human-readable; renders directly in the card
  raw: Record<string, unknown>;
  relevance?: "high" | "medium" | "low" | "unscored";
};

export type ConfidencePipelineState = {
  genePrior: { value: number; label: "low" | "moderate" | "high"; reason: string } | null;
  variantEffect: { value: number; label: "low" | "moderate" | "high"; reason: string } | null;
  mechanismGate: { value: number /* 0..1 */; reason: string } | null;
  crossSpecies: { value: number; label: "low" | "moderate" | "high"; reason: string } | null;
  overall: { label: "low" | "moderate" | "high"; reason: string } | null;
};

export type RealtimeEvent =
  | { type: "fragment"; data: EvidenceFragment }
  | { type: "narration"; data: string }
  | { type: "pipeline_update"; data: ConfidencePipelineState }
  | { type: "complete"; briefUrl: string };

// Doctor Brief — PROPOSE this shape to Person A and freeze it together before
// building /brief. It is the read-model the synthesis step writes out.
export type AcmgRow = {
  code: string;                 // e.g. "PP3"
  direction: "pathogenic" | "benign";
  strength: string;             // e.g. "supporting", "strong"
  fact: string;                 // the supporting fact, plain language
};

export type DoctorBrief = {
  runId: string;
  variant: string;
  clinicalContext: string;
  overall: { label: "low" | "moderate" | "high"; reason: string };
  layers: {
    genePrior: string;
    variantEffect: string;
    mechanismGate: string;
    crossSpecies: string;
  };
  acmgRows: AcmgRow[];
  plainSummary: string;
  whatWouldChangeThis?: string; // present when confidence is low
  ps3Caveat?: string;           // verbatim cross-species-functional caveat, when applicable
};
