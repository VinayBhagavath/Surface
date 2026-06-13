// ACMG/AMP 2015 evidence-code reference (Richards et al.), with the ClinGen SVI
// framing for model-organism / functional evidence. This is a code constant —
// Grok's synthesis call (Step 6) maps the gathered evidence onto these codes,
// and the Doctor Brief renders the rows. Providing the canonical descriptions +
// the PS3 caveat verbatim keeps the mapping auditable and honest.

export type AcmgCodeRef = {
  description: string;
  direction: "pathogenic" | "benign";
  defaultStrength: string;
};

export const ACMG_CODES: Record<string, AcmgCodeRef> = {
  PVS1: { description: "Null variant (nonsense, frameshift, canonical splice, etc.) in a gene where LoF is a known disease mechanism", direction: "pathogenic", defaultStrength: "very strong" },
  PS1: { description: "Same amino-acid change as a previously established pathogenic variant", direction: "pathogenic", defaultStrength: "strong" },
  PS3: { description: "Well-established functional studies show a damaging effect on the gene/protein", direction: "pathogenic", defaultStrength: "strong" },
  PM1: { description: "Located in a mutational hot spot and/or critical, well-established functional domain", direction: "pathogenic", defaultStrength: "moderate" },
  PM2: { description: "Absent (or extremely low frequency) in population databases (gnomAD)", direction: "pathogenic", defaultStrength: "moderate" },
  PM5: { description: "Novel missense change at a residue where a different pathogenic missense was seen", direction: "pathogenic", defaultStrength: "moderate" },
  PP2: { description: "Missense in a gene with a low rate of benign missense and where missense is a common disease mechanism", direction: "pathogenic", defaultStrength: "supporting" },
  PP3: { description: "Multiple computational predictors support a deleterious effect (AlphaMissense / REVEL / CADD + conservation)", direction: "pathogenic", defaultStrength: "supporting" },
  BA1: { description: "Allele frequency too high for the disorder (stand-alone benign)", direction: "benign", defaultStrength: "stand-alone" },
  BS1: { description: "Allele frequency greater than expected for the disorder", direction: "benign", defaultStrength: "strong" },
  BS3: { description: "Well-established functional studies show no damaging effect", direction: "benign", defaultStrength: "strong" },
  BP4: { description: "Multiple computational predictors suggest no impact (benign)", direction: "benign", defaultStrength: "supporting" },
};

/** ClinGen SVI guidance — applied verbatim in the Doctor Brief wherever a
 *  mouse / model-organism observation is mapped onto PS3-type functional
 *  evidence. Cross-species evidence is supporting strength at most. */
export const PS3_MODEL_ORGANISM_CAVEAT =
  "PS3 framing caveat: mouse-knockout / model-organism functional evidence is " +
  "applied at SUPPORTING strength (PS3_supporting) per ClinGen Sequence Variant " +
  "Interpretation (SVI) recommendations. A non-human assay does not by itself " +
  "establish the variant's effect on the human protein; cross-species " +
  "applicability requires a clean ortholog AND a disease mechanism that a " +
  "loss-of-function knockout can actually model.";
