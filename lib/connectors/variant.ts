// Shared variant-resolution types + small normalization helpers used across
// connectors. VEP (Step 0) populates a ResolvedVariant; downstream connectors
// take only the typed fields they need (gene symbol, GRCh38 coords, etc.).

export type ConsequenceClass =
  | "missense"
  | "lof"
  | "splice"
  | "synonymous"
  | "inframe_indel"
  | "other";

export type ResolvedVariant = {
  input: string;
  rsId: string | null;
  geneSymbol: string | null;
  geneId: string | null; // Ensembl human gene id
  mostSevereConsequence: string | null;
  consequenceClass: ConsequenceClass;
  chrom: string | null; // GRCh38
  pos: number | null; // GRCh38 start
  alleleString: string | null; // e.g. "C/T"
  proteinChange: string | null; // e.g. p.Phe32Ser
};

export function looksLikeRsId(v: string): boolean {
  return /^rs\d+$/i.test(v.trim());
}

export function looksLikeHgvs(v: string): boolean {
  return v.includes(":") && /[cgpmn]\./i.test(v);
}

export function nowIso(): string {
  return new Date().toISOString();
}

// MyVariant/dbNSFP fields are frequently arrays (one entry per transcript).
// These helpers collapse scalar-or-array into a single usable value.

export function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

export function maxNum(v: unknown): number | null {
  const a = asArray(v as number | number[]).filter(
    (x): x is number => typeof x === "number" && !Number.isNaN(x),
  );
  return a.length ? Math.max(...a) : null;
}

export function firstStr(v: unknown): string | null {
  for (const x of asArray(v)) if (typeof x === "string" && x) return x as string;
  return null;
}

export function uniqStrings(v: unknown): string[] {
  return [...new Set(asArray(v).filter((x): x is string => typeof x === "string"))];
}
