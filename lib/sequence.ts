// Sequence-context extraction for the DNA-level VUS viewer.
//
// Pulls the substitution out of the Ensembl VEP fragment's `raw` payload — the
// SAME captured pipeline output the rest of the app renders — and shapes it into
// a small, render-ready contract. We deliberately surface ONLY data the pipeline
// actually returned (codon triplet, ref/alt base, coordinates). We never invent
// flanking genomic sequence, because this is a clinical decision-support tool and
// fabricated bases would be misleading.

import type { EvidenceCard, EvidenceFragment } from "@/lib/types";

/** A single nucleotide position inside the affected codon. */
export type SequenceBase = {
  /** Uppercased nucleotide letter (A/C/G/T) or "?" if unknown. */
  letter: string;
  /** 0-based index within the codon (0..2). */
  index: number;
  /** True for the position that carries the substitution. */
  changed: boolean;
};

export type SequenceContext = {
  gene: string;
  chrom: string | null;
  pos: number | null;
  strand: number | null;
  transcript: string | null; // MANE / RefSeq accession
  consequence: string | null; // e.g. "missense"
  hgvsc: string | null; // e.g. "c.95T>C"
  hgvsp: string | null; // e.g. "p.Phe32Ser"
  cdnaPos: number | null; // coding-DNA position of the substitution
  refBase: string | null; // expected base, e.g. "T"
  altBase: string | null; // observed base, e.g. "C"
  /** Reference codon as three positions; the `changed` one is the substitution. */
  refCodon: SequenceBase[] | null;
  /** Observed codon (same frame), with the substituted position swapped. */
  altCodon: SequenceBase[] | null;
  aminoRef: string | null; // single-letter ref residue, e.g. "F"
  aminoAlt: string | null; // single-letter alt residue, e.g. "S"
  proteinPos: number | null; // residue number, e.g. 32
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Build the three-position codon track; the uppercase letter in `codonStr`
 *  marks the substituted base (Ensembl convention, e.g. "tTc"). */
function buildCodon(codonStr: string): { bases: SequenceBase[]; changeIndex: number } | null {
  const clean = codonStr.replace(/[^a-zA-Z]/g, "");
  if (clean.length < 1) return null;
  let changeIndex = clean.split("").findIndex((c) => c === c.toUpperCase() && /[A-Z]/.test(c));
  if (changeIndex < 0) changeIndex = 0;
  const bases: SequenceBase[] = clean.split("").map((c, i) => ({
    letter: c.toUpperCase(),
    index: i,
    changed: i === changeIndex,
  }));
  return { bases, changeIndex };
}

/** Parse a VEP fragment into render-ready sequence context, or null if the
 *  fragment lacks the fields we need (a non-coding / unresolved variant). */
export function parseSequenceContext(
  fragment: EvidenceFragment | undefined,
  fallbackGene: string,
): SequenceContext | null {
  if (!fragment || fragment.source !== "ensembl_vep") return null;
  const raw = fragment.raw as Record<string, unknown>;
  const resolved = (raw.resolved ?? {}) as Record<string, unknown>;
  const transcript = (raw.transcript ?? {}) as Record<string, unknown>;

  // ref/alt + cDNA position come from HGVS coding notation: c.<pos><REF>><ALT>
  const hgvscFull = str(transcript.hgvsc) ?? str(resolved.hgvsc);
  const hgvsc = hgvscFull ? hgvscFull.replace(/^.*:/, "") : null;
  const m = hgvsc?.match(/c\.(\d+)([ACGT])>([ACGT])/i) ?? null;
  const cdnaPos = m ? Number(m[1]) : null;
  let refBase = m ? m[2].toUpperCase() : null;
  let altBase = m ? m[3].toUpperCase() : null;

  // codon triplet (preferred source of the in-frame context)
  const codonStr = str(transcript.codons); // e.g. "tTc/tCc"
  let refCodon: SequenceBase[] | null = null;
  let altCodon: SequenceBase[] | null = null;
  if (codonStr) {
    const [refPart, altPart] = codonStr.split("/");
    const ref = refPart ? buildCodon(refPart) : null;
    const alt = altPart ? buildCodon(altPart) : null;
    if (ref) {
      refCodon = ref.bases;
      // derive ref/alt base from codon if HGVS was absent
      if (!refBase) refBase = ref.bases[ref.changeIndex]?.letter ?? null;
    }
    if (alt) {
      altCodon = alt.bases;
      if (!altBase) altBase = alt.bases[alt.changeIndex]?.letter ?? null;
    }
  }

  const amino = str(transcript.amino_acids); // "F/S"
  const [aminoRef, aminoAlt] = amino ? amino.split("/") : [null, null];

  const hgvsp =
    str(resolved.proteinChange) ??
    (str(transcript.hgvsp) ? str(transcript.hgvsp)!.replace(/^.*:/, "") : null);

  // require at least a substitution to render anything meaningful
  if (!refBase || !altBase) return null;

  return {
    gene: str(resolved.geneSymbol) ?? str(transcript.gene_symbol) ?? fallbackGene,
    chrom: str(resolved.chrom),
    pos: num(resolved.pos),
    strand: num(transcript.strand),
    transcript: str(transcript.mane_select) ?? str(transcript.transcript_id),
    consequence: str(resolved.consequenceClass) ?? str(resolved.mostSevereConsequence),
    hgvsc,
    hgvsp,
    cdnaPos,
    refBase,
    altBase,
    refCodon,
    altCodon,
    aminoRef: aminoRef ?? null,
    aminoAlt: aminoAlt ?? null,
    proteinPos: num(transcript.protein_start),
  };
}

/** Convenience: pull sequence context straight from an EvidenceCard. */
export function sequenceContextFromCard(card: EvidenceCard): SequenceContext | null {
  const vep = card.fragments.find((f) => f.source === "ensembl_vep");
  return parseSequenceContext(vep, card.geneSymbol);
}
