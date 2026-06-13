// Person B owned — intake dropdown options.
// `value` MUST match Person A's `lib/reference/panel-to-hpo.json` keys exactly
// (clinicalContext on `vus.evidence.requested`). Labels come from that file's
// `_meta.labels` block. See docs/CROSS-TEAM-ALIGNMENT.md.

export type ClinicalContextOption = {
  value: string;
  label: string;
};

/** Ordered for the intake `<Select>` in Step 5. */
export const CLINICAL_CONTEXT_OPTIONS: ClinicalContextOption[] = [
  { value: "hypercholesterolemia", label: "High cholesterol / lipid disorder" },
  { value: "cardiomyopathy", label: "Cardiomyopathy" },
  { value: "arrhythmia", label: "Arrhythmia / long-QT" },
  { value: "long_qt", label: "Long-QT syndrome" },
  { value: "neurodevelopmental", label: "Neurodevelopmental / intellectual disability" },
  { value: "epilepsy", label: "Epilepsy / seizures" },
  { value: "immune", label: "Immune / immunodeficiency" },
  { value: "skeletal", label: "Skeletal dysplasia" },
  { value: "renal", label: "Kidney / renal" },
  { value: "metabolic", label: "Metabolic disorder" },
  { value: "cancer", label: "Cancer predisposition" },
];
