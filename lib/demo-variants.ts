// The three real, no-mocks demo variants, chosen empirically so their LIVE data
// exercises every path of the pipeline. See docs/DEMO_VARIANTS.md for the full
// rationale and the real values behind each.

export type DemoVariant = {
  id: string;
  label: string;
  variant: string; // rsID (assembly-independent input)
  clinicalContext: string;
  expectation: string;
};

export const DEMO_VARIANTS: DemoVariant[] = [
  {
    id: "ldlr",
    label: "LDLR p.Phe32Ser — everything agrees → HIGH",
    variant: "rs879254403",
    clinicalContext: "hypercholesterolemia",
    expectation:
      "AM 0.99 / REVEL 0.97 / CADD 29 agree deleterious; conserved; clean 1:1 ortholog; Ldlr KO ↑cholesterol p=1.8e-63 matches context; LoF gene → gate open → HIGH",
  },
  {
    id: "cacna1c",
    label: "CACNA1C p.Arg533Trp — mechanism gate CLOSES",
    variant: "rs776805699",
    clinicalContext: "arrhythmia",
    expectation:
      "Strong predictors + Cacna1c KO embryonic-lethal (dramatic), BUT Timothy syndrome is gain-of-function → gate ≈ 0 suppresses the cross-species layer",
  },
  {
    id: "kcnq1",
    label: "KCNQ1 p.Ala107Val — uncertainty stays honest",
    variant: "rs2133727494",
    clinicalContext: "long_qt",
    expectation:
      "AM benign vs REVEL 0.68 vs CADD 23 disagree; no significant IMPC phenotype (found:false); conserved residue → moderate/low",
  },
];

export function demoById(id: string): DemoVariant | undefined {
  return DEMO_VARIANTS.find((d) => d.id === id);
}
