// Step 1 — Gene-Level Prior.
// gnomAD GraphQL constraint for the gene: LOEUF (oe_lof_upper), pLI, missense-z.
// Fires in parallel with Step 0 (it's a property of the gene, not the variant).

import { fetchJson } from "@/lib/http";
import type { EvidenceFragment } from "@/lib/types";
import { nowIso } from "@/lib/connectors/variant";

const GNOMAD_API = "https://gnomad.broadinstitute.org/api";

type Constraint = {
  pli: number | null;
  oe_lof: number | null;
  oe_lof_upper: number | null; // LOEUF
  oe_mis: number | null;
  mis_z: number | null;
  syn_z: number | null;
  lof_z: number | null;
  exp_lof: number | null;
  obs_lof: number | null;
};
type GnomadResp = {
  data?: { gene?: { gene_id?: string; symbol?: string; gnomad_constraint?: Constraint | null } };
  errors?: { message: string }[];
};

const QUERY = `query Constraint($symbol: String!, $ref: ReferenceGenomeId!) {
  gene(gene_symbol: $symbol, reference_genome: $ref) {
    gene_id
    symbol
    gnomad_constraint {
      pli oe_lof oe_lof_upper oe_mis mis_z syn_z lof_z exp_lof obs_lof
    }
  }
}`;

async function queryConstraint(symbol: string, ref: "GRCh38" | "GRCh37") {
  const resp = await fetchJson<GnomadResp>(GNOMAD_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { symbol, ref } }),
    timeoutMs: 25_000,
  });
  return resp.data?.gene ?? null;
}

export async function gnomadConstraint(input: {
  geneSymbol: string;
}): Promise<EvidenceFragment> {
  const symbol = input.geneSymbol;

  // GRCh38 (gnomAD v4) first; some genes only carry constraint on GRCh37 (v2.1.1).
  let gene = await queryConstraint(symbol, "GRCh38");
  let assembly = "GRCh38 (gnomAD v4)";
  if (!gene?.gnomad_constraint) {
    gene = await queryConstraint(symbol, "GRCh37");
    assembly = "GRCh37 (gnomAD v2.1.1)";
  }

  const c = gene?.gnomad_constraint ?? null;
  const found = Boolean(c);

  const loeuf = c?.oe_lof_upper ?? null;
  const pli = c?.pli ?? null;
  const misZ = c?.mis_z ?? null;

  let summary: string;
  if (found) {
    const fmt = (n: number | null, d = 2) => (n === null ? "n/a" : n.toFixed(d));
    const constraintWord =
      loeuf !== null && loeuf < 0.35
        ? "highly LoF-intolerant"
        : loeuf !== null && loeuf < 0.6
          ? "LoF-constrained"
          : loeuf !== null && loeuf < 1.0
            ? "moderately constrained"
            : "LoF-tolerant";
    summary = `gnomAD constraint: LOEUF ${fmt(loeuf)}, pLI ${fmt(pli)}, missense-z ${fmt(misZ)} — ${constraintWord} (${assembly})`;
  } else {
    summary = `gnomAD: no constraint metrics found for ${symbol}`;
  }

  return {
    id: "step1-gnomad-constraint",
    source: "gnomad_constraint",
    step: 1,
    queryTime: nowIso(),
    found,
    summary,
    raw: { geneId: gene?.gene_id ?? null, assembly, constraint: c, loeuf, pli, misZ },
  };
}
