// Step 4 — Orthology.
// Ensembl homology is the source of truth for the mouse ortholog (type +
// % identity + mouse gene id -> symbol, which IMPC needs). DIOPT is layered on
// as a multi-method confidence rank (best-effort: if its API is slow/changed,
// we proceed on Ensembl alone and say so).

import { fetchJson, qs } from "@/lib/http";
import type { EvidenceFragment } from "@/lib/types";
import { maxNum, nowIso } from "@/lib/connectors/variant";

const ENSEMBL = "https://rest.ensembl.org";

export type OrthologResult = {
  mouseGeneSymbol: string | null;
  mouseGeneId: string | null;
  orthologType: string | null; // ortholog_one2one | ortholog_one2many | ortholog_many2many
  percentIdentity: number | null;
  quality: "high" | "moderate" | "low" | null; // clean 1:1 = high
  dioptScore: number | null;
  dioptMax: number | null;
};

type Homology = {
  type?: string;
  target?: { id?: string; perc_id?: number; species?: string };
  source?: { perc_id?: number };
};

type DioptEntry = {
  score?: unknown;
  count?: unknown;
};

type DioptResponse = {
  results?: Record<string, Record<string, DioptEntry>>;
  search_details?: { tool_count?: unknown };
};

function qualityFor(type: string | null): OrthologResult["quality"] {
  if (!type) return null;
  if (type === "ortholog_one2one") return "high";
  if (type.includes("one2many") || type.includes("many2one")) return "moderate";
  if (type.includes("many2many")) return "low";
  return "moderate";
}

async function lookupSymbol(geneId: string): Promise<string | null> {
  try {
    const r = await fetchJson<{ display_name?: string }>(
      `${ENSEMBL}/lookup/id/${geneId}${qs({ "content-type": "application/json" })}`,
      { timeoutMs: 15_000 },
    );
    return r.display_name ?? null;
  } catch {
    return null;
  }
}

async function tryDiopt(symbol: string): Promise<{ score: number; max: number } | null> {
  try {
    const url = `https://www.flyrnai.org/tools/diopt/web/diopt_api/v9/get_orthologs_from_gene/9606/${encodeURIComponent(symbol)}/10090/none/none`;
    const data = await fetchJson<DioptResponse>(url, { timeoutMs: 12_000, retries: 1 });
    const results = data?.results;
    if (!results || typeof results !== "object") return null;
    let best = -1;
    for (const human of Object.values(results)) {
      if (!human || typeof human !== "object") continue;
      for (const m of Object.values(human)) {
        const s = typeof m.score === "number" ? m.score : Number(m.count);
        if (Number.isFinite(s) && s > best) best = s;
      }
    }
    if (best < 0) return null;
    const max = Number(data?.search_details?.tool_count) || 18;
    return { score: best, max };
  } catch {
    return null;
  }
}

export async function ensemblDiopt(input: {
  geneSymbol: string;
}): Promise<{ fragment: EvidenceFragment; ortholog: OrthologResult }> {
  const t = nowIso();
  const url = `${ENSEMBL}/homology/symbol/human/${encodeURIComponent(input.geneSymbol)}${qs({
    target_species: "mouse",
    type: "orthologues",
    "content-type": "application/json",
  })}`;

  const resp = await fetchJson<{ data?: { homologies?: Homology[] }[] }>(url, { timeoutMs: 25_000 });
  const homologies = resp.data?.[0]?.homologies ?? [];

  // Prefer a 1:1 ortholog if present, else the highest-identity one.
  const sorted = [...homologies].sort(
    (a, b) => (b.target?.perc_id ?? 0) - (a.target?.perc_id ?? 0),
  );
  const best =
    homologies.find((h) => h.type === "ortholog_one2one") ?? sorted[0] ?? null;

  const mouseGeneId = best?.target?.id ?? null;
  const mouseGeneSymbol = mouseGeneId ? await lookupSymbol(mouseGeneId) : null;
  const diopt = await tryDiopt(input.geneSymbol);

  const ortholog: OrthologResult = {
    mouseGeneSymbol,
    mouseGeneId,
    orthologType: best?.type ?? null,
    percentIdentity: maxNum([best?.target?.perc_id, best?.source?.perc_id]),
    quality: qualityFor(best?.type ?? null),
    dioptScore: diopt?.score ?? null,
    dioptMax: diopt?.max ?? null,
  };

  const found = Boolean(mouseGeneId);
  let summary: string;
  if (!found) {
    summary = `Ensembl/DIOPT: no mouse ortholog found for ${input.geneSymbol}`;
  } else {
    const clean =
      ortholog.quality === "high"
        ? "clean 1:1 mouse ortholog"
        : ortholog.quality === "moderate"
          ? "mouse ortholog present but relationship is one-to-many"
          : "multiple paralogous mouse genes — ortholog relationship unclear";
    const idPart = ortholog.percentIdentity !== null ? `, ${ortholog.percentIdentity.toFixed(0)}% identity` : "";
    const dioptPart = diopt ? `, DIOPT ${diopt.score}/${diopt.max}` : ", DIOPT rank unavailable";
    summary = `Ensembl: ${clean} (${mouseGeneSymbol ?? mouseGeneId}${idPart})${dioptPart}`;
  }

  const fragment: EvidenceFragment = {
    id: "step4-ensembl-diopt",
    source: "ensembl_diopt",
    step: 4,
    queryTime: t,
    found,
    summary,
    raw: { ...ortholog, homologyCount: homologies.length },
  };

  return { fragment, ortholog };
}
