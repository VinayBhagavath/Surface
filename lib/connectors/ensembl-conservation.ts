// Step 2 — Per-residue conservation.
// Ensembl REST GERP "constrained" elements overlapping the variant position
// (GRCh38). A variant sitting inside a high-scoring constrained element is
// strong evidence the residue is conserved across mammals. We also fold in the
// per-residue dbNSFP scores (GERP++ / phyloP) the pipeline already fetched from
// MyVariant, when provided — both are real, and together they're more honest
// than either alone (documented limitation: Ensembl gives element-level GERP,
// dbNSFP gives the per-base score).

import { fetchJson, qs } from "@/lib/http";
import type { EvidenceFragment } from "@/lib/types";
import { maxNum, nowIso } from "@/lib/connectors/variant";

const ENSEMBL = "https://rest.ensembl.org";

type ConstrainedElement = {
  seq_region_name?: string;
  start?: number;
  end?: number;
  score?: number;
  feature_type?: string;
};

export async function ensemblConservation(input: {
  chrom: string | null;
  pos: number | null;
  geneSymbol?: string | null;
  perResidueGerp?: number | null;
  perResiduePhyloP?: number | null;
}): Promise<EvidenceFragment> {
  const { chrom, pos } = input;
  const t = nowIso();

  if (!chrom || !pos) {
    return {
      id: "step2-ensembl-conservation",
      source: "ensembl_conservation",
      step: 2,
      queryTime: t,
      found: false,
      summary: "Ensembl conservation: variant position unavailable (could not resolve GRCh38 coordinates)",
      raw: { chrom, pos },
    };
  }

  // Query a tight window around the residue so a point inside an element is caught.
  const url = `${ENSEMBL}/overlap/region/human/${chrom}:${pos - 1}-${pos + 1}${qs({
    feature: "constrained",
    "content-type": "application/json",
  })}`;

  const elements = await fetchJson<ConstrainedElement[]>(url, { timeoutMs: 25_000 });
  const within = (elements ?? []).filter(
    (e) => typeof e.start === "number" && typeof e.end === "number" && e.start <= pos && e.end >= pos,
  );
  const elementScore = maxNum((within.length ? within : elements ?? []).map((e) => e.score ?? null));
  const inElement = within.length > 0;

  const gerp = input.perResidueGerp ?? null;
  const phyloP = input.perResiduePhyloP ?? null;

  // "found" = we have ANY real conservation signal (element overlap or per-residue score).
  const found = inElement || gerp !== null || phyloP !== null;

  const bits: string[] = [];
  if (inElement) bits.push(`lies within a GERP constrained element (score ${elementScore?.toFixed(1)})`);
  else if ((elements ?? []).length) bits.push(`near a constrained element (score ${elementScore?.toFixed(1)})`);
  if (gerp !== null) bits.push(`GERP++ ${gerp.toFixed(1)}`);
  if (phyloP !== null) bits.push(`phyloP ${phyloP.toFixed(2)}`);

  const conservedHint =
    (elementScore !== null && elementScore > 20) || (gerp !== null && gerp > 4) || (phyloP !== null && phyloP > 2)
      ? " — highly conserved across mammals"
      : found
        ? " — modest conservation"
        : "";

  const summary = found
    ? `Ensembl conservation: ${bits.join(", ")}${conservedHint}`
    : `Ensembl conservation: no constrained element or per-residue score at GRCh38 ${chrom}:${pos}`;

  return {
    id: "step2-ensembl-conservation",
    source: "ensembl_conservation",
    step: 2,
    queryTime: t,
    found,
    summary,
    raw: { chrom, pos, inElement, elementScore, perResidueGerp: gerp, perResiduePhyloP: phyloP, elements: elements ?? [] },
  };
}
