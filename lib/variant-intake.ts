// Turn an uploaded sequencing file into a variant to investigate.
//
// Accepts a VCF (or a plain text list of rsIDs / HGVS) and pulls out candidate
// variants. We then match against the known demo variants so the experience is
// smooth and grounded in real captured pipeline data; an unrecognised file
// still resolves to a real, coherent run rather than failing.

import { DEMOS, DEFAULT_DEMO, type DemoId } from "@/fixtures/runs";

export type ResolvedVariant = {
  demo: DemoId;
  variant: string; // the rsID / HGVS we'll investigate
  clinicalContext: string;
  matched: boolean; // true when the file actually contained a known variant
};

/** Extract candidate variant identifiers from VCF or plain-text content. */
export function parseVariantsFromText(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // VCF data line: CHROM POS ID REF ALT ...
    if (trimmed.includes("\t")) {
      const cols = trimmed.split("\t");
      if (cols.length >= 5) {
        const [chrom, pos, id, ref, alt] = cols;
        if (chrom && pos) {
          out.push(id && id !== "." ? id : `${chrom}-${pos}-${ref}-${alt}`);
          continue;
        }
      }
    }
    // plain rsID or HGVS on its own line
    if (/^(rs\d+|[A-Z_]+\d+(\.\d+)?:[cgp]\.)/i.test(trimmed)) {
      out.push(trimmed.split(/\s+/)[0]);
    }
    if (out.length >= 50) break;
  }
  return out;
}

/** Match parsed variants to a known demo (real captured data) or fall back. */
export function resolveVariant(variants: string[]): ResolvedVariant {
  const lower = variants.map((v) => v.toLowerCase());
  for (const d of DEMOS) {
    if (lower.includes(d.variant.toLowerCase())) {
      return { demo: d.id, variant: d.variant, clinicalContext: d.clinicalContext, matched: true };
    }
  }
  const fallback = DEMOS.find((d) => d.id === DEFAULT_DEMO) ?? DEMOS[0];
  return {
    demo: fallback.id,
    variant: fallback.variant,
    clinicalContext: fallback.clinicalContext,
    matched: false,
  };
}
