// Server Action: annotate parsed VCF records to gene + consequence via the
// existing Ensembl VEP connector. Runs server-side so the keyless genomics APIs
// are reached without exposing anything; the raw file never leaves the browser —
// only the parsed coordinates needed for lookup are sent, and nothing here is
// persisted or logged at the variant level.
"use server";

import { ensemblVep } from "@/lib/connectors";
import type { VcfVariant, Zygosity } from "@/lib/vcf";

export type AnnotatedVariant = {
  index: number;
  query: string; // rsID or genomic HGVS used for the lookup
  rsid: string | null;
  chrom: string;
  pos: number;
  ref: string;
  alt: string;
  zygosity: Zygosity;
  gene: string | null;
  consequence: string | null; // human-readable most-severe consequence
  consequenceClass: string | null;
  proteinChange: string | null;
  found: boolean;
};

const CONCURRENCY = 5;
const MAX_ANNOTATE = 50; // safety cap; the parser already caps the list

async function annotateOne(index: number, v: VcfVariant): Promise<AnnotatedVariant> {
  const base = {
    index,
    query: v.query,
    rsid: v.id,
    chrom: v.chrom,
    pos: v.pos,
    ref: v.ref,
    alt: v.alt,
    zygosity: v.zygosity,
  };
  try {
    const { resolved } = await ensemblVep({ variant: v.query });
    return {
      ...base,
      gene: resolved.geneSymbol,
      consequence: resolved.mostSevereConsequence
        ? resolved.mostSevereConsequence.replace(/_/g, " ")
        : null,
      consequenceClass: resolved.consequenceClass,
      proteinChange: resolved.proteinChange,
      found: Boolean(resolved.geneSymbol),
    };
  } catch {
    return { ...base, gene: null, consequence: null, consequenceClass: null, proteinChange: null, found: false };
  }
}

export async function annotateVariants(records: VcfVariant[]): Promise<AnnotatedVariant[]> {
  const slice = records.slice(0, MAX_ANNOTATE);
  const out = new Array<AnnotatedVariant>(slice.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < slice.length) {
      const i = cursor++;
      out[i] = await annotateOne(i, slice[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, slice.length) }, worker));
  return out;
}
