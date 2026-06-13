// Step 4 — Mouse knockout phenotype (IMPC).
// Returns potentially MANY fragments (one per significant phenotype), all
// relevance:"unscored" — Grok assigns relevance later (Step 5). Zygosity is
// matched to the gene's inheritance mode when known; lethality (viability) is
// detected and tagged as a high-weight essentiality signal regardless of
// zygosity (per architecture addendum §7), NOT treated as "no phenotype".

import { fetchJson, qs } from "@/lib/http";
import type { EvidenceFragment } from "@/lib/types";
import { nowIso } from "@/lib/connectors/variant";

const IMPC_SOLR = "https://www.ebi.ac.uk/mi/impc/solr/genotype-phenotype/select";
const MAX_PHENOTYPE_FRAGMENTS = 12;
const LETHAL_RE = /lethal|lethality|mortality|prenatal death|perinatal death/i;

type ImpcDoc = {
  marker_symbol?: string;
  mp_term_id?: string;
  mp_term_name?: string;
  p_value?: number;
  zygosity?: string;
  top_level_mp_term_name?: string[] | string;
  effect_size?: number;
};

export type ImpcResult = {
  mpTermIds: string[];
  phenotypeCount: number;
  lethal: boolean;
  lethalPhenotype: string | null;
};

function sanitizeId(mp: string): string {
  return `step4-impc-${mp.replace(/[^A-Za-z0-9]/g, "_")}`;
}

export async function impc(input: {
  mouseGeneSymbol: string;
  zygosity?: "homozygote" | "heterozygote" | "hemizygote" | null;
}): Promise<{ fragments: EvidenceFragment[]; result: ImpcResult }> {
  const t = nowIso();
  const url = `${IMPC_SOLR}${qs({
    q: `marker_symbol:${input.mouseGeneSymbol}`,
    rows: 200,
    wt: "json",
    fl: "marker_symbol,mp_term_id,mp_term_name,p_value,zygosity,top_level_mp_term_name,effect_size",
  })}`;

  const resp = await fetchJson<{ response?: { numFound?: number; docs?: ImpcDoc[] } }>(url, {
    timeoutMs: 25_000,
  });
  const docs = resp.response?.docs ?? [];

  if (docs.length === 0) {
    return {
      fragments: [
        {
          id: "step4-impc-none",
          source: "impc",
          step: 4,
          queryTime: t,
          found: false,
          summary: `IMPC: no significant knockout phenotype recorded for ${input.mouseGeneSymbol}`,
          relevance: "unscored",
          raw: { marker_symbol: input.mouseGeneSymbol, numFound: 0 },
        },
      ],
      result: { mpTermIds: [], phenotypeCount: 0, lethal: false, lethalPhenotype: null },
    };
  }

  // Lethality is captured FIRST, across all zygosities (essentiality signal).
  const lethalDoc = docs.find((d) => d.mp_term_name && LETHAL_RE.test(d.mp_term_name));

  // Dedup phenotypes by mp_term_id, keeping the most significant (lowest p).
  // Prefer the matched zygosity when one is specified, but don't drop the gene's
  // signal entirely if nothing matches it.
  const zygMatch = (d: ImpcDoc) => !input.zygosity || d.zygosity === input.zygosity;
  const pool = docs.some(zygMatch) ? docs.filter(zygMatch) : docs;
  const zygFellBack = !docs.some(zygMatch);

  const byTerm = new Map<string, ImpcDoc>();
  for (const d of pool) {
    if (!d.mp_term_id) continue;
    if (LETHAL_RE.test(d.mp_term_name ?? "")) continue; // lethality handled separately
    const prev = byTerm.get(d.mp_term_id);
    if (!prev || (d.p_value ?? 1) < (prev.p_value ?? 1)) byTerm.set(d.mp_term_id, d);
  }
  const phenotypes = [...byTerm.values()]
    .sort((a, b) => (a.p_value ?? 1) - (b.p_value ?? 1))
    .slice(0, MAX_PHENOTYPE_FRAGMENTS);

  const fragments: EvidenceFragment[] = [];

  if (lethalDoc) {
    fragments.push({
      id: "step4-impc-viability",
      source: "impc",
      step: 4,
      queryTime: t,
      found: true,
      relevance: "unscored",
      summary: `IMPC: ${input.mouseGeneSymbol} knockout shows ${lethalDoc.mp_term_name} (${lethalDoc.zygosity}) — essentiality signal (high weight: lethality on KO indicates the gene is essential, NOT "no phenotype")`,
      raw: {
        viabilityLethal: true,
        mp_term_id: lethalDoc.mp_term_id,
        mp_term_name: lethalDoc.mp_term_name,
        zygosity: lethalDoc.zygosity,
        p_value: lethalDoc.p_value,
      },
    });
  }

  for (const d of phenotypes) {
    const top = Array.isArray(d.top_level_mp_term_name)
      ? d.top_level_mp_term_name.join(", ")
      : d.top_level_mp_term_name ?? "";
    fragments.push({
      id: sanitizeId(d.mp_term_id as string),
      source: "impc",
      step: 4,
      queryTime: t,
      found: true,
      relevance: "unscored",
      summary: `IMPC: ${input.mouseGeneSymbol} knockout (${d.zygosity}) → ${d.mp_term_name}${
        typeof d.p_value === "number" ? ` (p=${d.p_value.toExponential(1)})` : ""
      }`,
      raw: {
        mp_term_id: d.mp_term_id,
        mp_term_name: d.mp_term_name,
        zygosity: d.zygosity,
        p_value: d.p_value,
        top_level: d.top_level_mp_term_name,
        effect_size: d.effect_size,
        zygosityFellBack: zygFellBack,
      },
    });
  }

  const mpTermIds = [
    ...(lethalDoc?.mp_term_id ? [lethalDoc.mp_term_id] : []),
    ...phenotypes.map((d) => d.mp_term_id as string),
  ].filter(Boolean);

  return {
    fragments,
    result: {
      mpTermIds,
      phenotypeCount: phenotypes.length + (lethalDoc ? 1 : 0),
      lethal: Boolean(lethalDoc),
      lethalPhenotype: lethalDoc?.mp_term_name ?? null,
    },
  };
}
