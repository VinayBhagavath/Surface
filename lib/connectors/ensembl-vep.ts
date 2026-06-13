// Step 0 — Variant-Type Router.
// One Ensembl VEP call returns the consequence type (deterministic dispatch,
// not a Grok call) plus the gene symbol and GRCh38 coordinates that every
// downstream connector depends on.

import { fetchJson, qs } from "@/lib/http";
import type { EvidenceFragment } from "@/lib/types";
import {
  type ConsequenceClass,
  type ResolvedVariant,
  looksLikeRsId,
  nowIso,
} from "@/lib/connectors/variant";

const ENSEMBL = "https://rest.ensembl.org";

type VepTranscript = {
  gene_symbol?: string;
  gene_id?: string;
  consequence_terms?: string[];
  canonical?: number;
  mane_select?: string;
  biotype?: string;
  hgvsp?: string;
};
type VepResult = {
  most_severe_consequence?: string;
  seq_region_name?: string;
  start?: number;
  allele_string?: string;
  id?: string;
  transcript_consequences?: VepTranscript[];
  colocated_variants?: { id?: string }[];
};

const LOF = new Set([
  "stop_gained",
  "frameshift_variant",
  "splice_acceptor_variant",
  "splice_donor_variant",
  "start_lost",
  "stop_lost",
  "transcript_ablation",
]);
const INFRAME = new Set(["inframe_insertion", "inframe_deletion"]);

function classify(c: string | undefined): ConsequenceClass {
  if (!c) return "other";
  if (c === "missense_variant") return "missense";
  if (LOF.has(c)) return "lof";
  if (c.includes("splice")) return "splice";
  if (c === "synonymous_variant") return "synonymous";
  if (INFRAME.has(c)) return "inframe_indel";
  return "other";
}

function pickTranscript(tcs: VepTranscript[]): VepTranscript | undefined {
  return (
    tcs.find((t) => t.mane_select) ||
    tcs.find((t) => t.canonical === 1) ||
    tcs.find((t) => t.biotype === "protein_coding") ||
    tcs[0]
  );
}

export async function ensemblVep(input: {
  variant: string;
}): Promise<{ fragment: EvidenceFragment; resolved: ResolvedVariant }> {
  const v = input.variant.trim();
  const isRs = looksLikeRsId(v);
  const path = isRs
    ? `/vep/human/id/${encodeURIComponent(v)}`
    : `/vep/human/hgvs/${encodeURIComponent(v)}`;
  const url = `${ENSEMBL}${path}${qs({
    "content-type": "application/json",
    hgvs: 1,
    canonical: 1,
    mane: 1,
  })}`;

  const arr = await fetchJson<VepResult[]>(url, { timeoutMs: 30_000 });
  const r = Array.isArray(arr) ? arr[0] : undefined;

  const tcs = r?.transcript_consequences ?? [];
  const tc = pickTranscript(tcs);
  const rsId = isRs
    ? v
    : (r?.colocated_variants ?? []).map((c) => c.id).find((id) => id && /^rs\d+/i.test(id)) ??
      null;

  const consequence = tc?.consequence_terms?.[0] ?? r?.most_severe_consequence;
  const resolved: ResolvedVariant = {
    input: v,
    rsId,
    geneSymbol: tc?.gene_symbol ?? null,
    geneId: tc?.gene_id ?? null,
    mostSevereConsequence: r?.most_severe_consequence ?? consequence ?? null,
    consequenceClass: classify(r?.most_severe_consequence ?? consequence),
    chrom: r?.seq_region_name ?? null,
    pos: typeof r?.start === "number" ? r.start : null,
    alleleString: r?.allele_string ?? null,
    proteinChange: tc?.hgvsp ? tc.hgvsp.split(":").pop() ?? null : null,
  };

  const found = Boolean(r && resolved.geneSymbol);
  const summary = found
    ? `Ensembl VEP: ${resolved.mostSevereConsequence?.replace(/_/g, " ")} in ${resolved.geneSymbol}` +
      (resolved.proteinChange ? ` (${resolved.proteinChange})` : "") +
      ` — GRCh38 ${resolved.chrom}:${resolved.pos}`
    : `Ensembl VEP: could not resolve a consequence/gene for "${v}"`;

  const fragment: EvidenceFragment = {
    id: "step0-ensembl-vep",
    source: "ensembl_vep",
    step: 0,
    queryTime: nowIso(),
    found,
    summary,
    raw: { resolved, most_severe_consequence: r?.most_severe_consequence, transcript: tc ?? null },
  };

  return { fragment, resolved };
}
