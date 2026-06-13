// VCF parsing — turn an uploaded sequencing file into structured variant records.
//
// Pure + dependency-free so it runs the same in the browser (intake) and in
// tests. Extracts CHROM/POS/ID/REF/ALT/GT for every record, derives zygosity
// from the genotype, and produces the identifier we hand to Ensembl VEP (the
// rsID when present, otherwise genomic HGVS). Returns structured diagnostics
// instead of throwing, so the UI can show a specific, friendly error.

export type Zygosity = "heterozygous" | "homozygous" | "hemizygous" | "unknown";

export type VcfVariant = {
  chrom: string; // as written, e.g. "chr17"
  pos: number;
  id: string | null; // rsID when present (not ".")
  ref: string;
  alt: string; // first ALT allele
  filter: string | null;
  gt: string | null;
  zygosity: Zygosity;
  /** Identifier handed to the pipeline / Ensembl VEP: rsID, else genomic HGVS. */
  query: string;
};

export type VcfParse =
  | {
      ok: true;
      reference: string | null;
      variants: VcfVariant[];
      total: number; // usable records found (before the display cap)
      filteredOut: number; // records excluded because FILTER was not PASS/.
      truncated: boolean; // true if we capped the list
    }
  | { ok: false; reason: string };

const MAX_VARIANTS = 200;

/** Strip a leading "chr" and build genomic HGVS, e.g. "17:g.43093464G>A". */
export function genomicHgvs(chrom: string, pos: number, ref: string, alt: string): string {
  const c = chrom.replace(/^chr/i, "");
  return `${c}:g.${pos}${ref}>${alt}`;
}

export function zygosityFromGt(gt: string | null): Zygosity {
  if (!gt) return "unknown";
  const alleles = gt.replace(/\|/g, "/").split("/").filter((a) => a !== "" && a !== ".");
  if (alleles.length === 1) return "hemizygous";
  if (alleles.length === 2) {
    const [a, b] = alleles;
    const nonRef = (x: string) => x !== "0";
    if (nonRef(a) && nonRef(b)) return a === b ? "homozygous" : "heterozygous";
    if (nonRef(a) || nonRef(b)) return "heterozygous";
    return "unknown"; // 0/0 — homozygous reference, not a variant call
  }
  return "unknown";
}

function looksLikeVcf(text: string): boolean {
  return /^##fileformat=VCF/im.test(text) || /^#CHROM\s+POS\s+ID/im.test(text) || /\trs\d+\t/.test(text);
}

export function parseVcf(text: string): VcfParse {
  if (!text || !text.trim()) return { ok: false, reason: "That file is empty." };
  if (!looksLikeVcf(text)) {
    return {
      ok: false,
      reason: "That doesn't look like a VCF file. Upload a .vcf (or .vcf.gz) of variant calls.",
    };
  }

  const lines = text.split(/\r?\n/);
  let reference: string | null = null;
  const variants: VcfVariant[] = [];
  let filteredOut = 0;
  let dataLines = 0;
  let malformed = 0;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) continue;
    if (line.startsWith("##")) {
      const ref = line.match(/^##reference=(.+)$/i);
      if (ref) reference = ref[1].replace(/^.*\//, "").trim();
      continue;
    }
    if (line.startsWith("#")) continue; // column header

    dataLines += 1;
    const cols = line.split("\t");
    if (cols.length < 5) {
      malformed += 1;
      continue;
    }
    const [chrom, posStr, idCol, ref, altCol] = cols;
    const pos = Number(posStr);
    if (!chrom || !Number.isFinite(pos) || !ref || !altCol) {
      malformed += 1;
      continue;
    }
    const filter = cols[6] ?? null;
    // Treat PASS or "." (no filter applied) or empty as usable; anything else is filtered out.
    const passes = !filter || filter === "PASS" || filter === ".";
    if (!passes) {
      filteredOut += 1;
      continue;
    }

    const id = idCol && idCol !== "." ? idCol.split(";")[0] : null;
    const alt = altCol.split(",")[0];

    // GT from FORMAT/SAMPLE columns (8 = FORMAT, 9 = first sample), if present.
    let gt: string | null = null;
    if (cols.length >= 10) {
      const fmt = cols[8].split(":");
      const gtIdx = fmt.indexOf("GT");
      if (gtIdx >= 0) gt = cols[9].split(":")[gtIdx] ?? null;
    }

    variants.push({
      chrom,
      pos,
      id,
      ref,
      alt,
      filter,
      gt,
      zygosity: zygosityFromGt(gt),
      query: id ?? genomicHgvs(chrom, pos, ref, alt),
    });
  }

  if (variants.length === 0) {
    if (filteredOut > 0)
      return {
        ok: false,
        reason: `All ${filteredOut} variant${filteredOut === 1 ? "" : "s"} in this file were filtered out (none marked PASS).`,
      };
    if (dataLines === 0)
      return { ok: false, reason: "No variant records found in that VCF (only header lines)." };
    if (malformed > 0)
      return { ok: false, reason: "Couldn't read the variant rows — the file looks malformed." };
    return { ok: false, reason: "No usable variants found in that file." };
  }

  const truncated = variants.length > MAX_VARIANTS;
  return {
    ok: true,
    reference,
    variants: truncated ? variants.slice(0, MAX_VARIANTS) : variants,
    total: variants.length,
    filteredOut,
    truncated,
  };
}
