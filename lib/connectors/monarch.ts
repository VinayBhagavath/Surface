// Step 4 — Cross-species phenotype similarity (Monarch / Phenodigm).
// Semantic similarity between the mouse MP terms (from IMPC) and the patient's
// HPO terms (from the clinical-context -> HPO map). Returns the best-matching
// MP<->HPO pair + score; Grok then sanity-checks (Step 5) whether the NUMBER
// matches what the actual terms describe.

import { fetchJson } from "@/lib/http";
import type { EvidenceFragment } from "@/lib/types";
import { nowIso } from "@/lib/connectors/variant";

const MONARCH_SEMSIM = "https://api.monarchinitiative.org/v3/api/semsim/compare";

type BestMatch = {
  match_source?: string;
  match_source_label?: string;
  match_target?: string;
  match_target_label?: string;
  score?: number;
  similarity?: { phenodigm_score?: number; jaccard_similarity?: number; ancestor_label?: string };
};
type SemsimResp = {
  subject_best_matches?: Record<string, BestMatch>;
  object_best_matches?: Record<string, BestMatch>;
};

export type MonarchResult = {
  similarityScore: number | null; // IC-based best-match score (higher = closer)
  phenodigmScore: number | null;
  bestPair: { mp: string; mpLabel: string; hpo: string; hpoLabel: string } | null;
};

export async function monarch(input: {
  mpTermIds: string[];
  hpoTermIds: string[];
}): Promise<{ fragment: EvidenceFragment; result: MonarchResult }> {
  const t = nowIso();
  const empty: MonarchResult = { similarityScore: null, phenodigmScore: null, bestPair: null };

  if (input.mpTermIds.length === 0 || input.hpoTermIds.length === 0) {
    const why =
      input.mpTermIds.length === 0
        ? "no mouse phenotype (MP) terms to compare"
        : "no mapped patient HPO terms for this clinical context";
    return {
      fragment: {
        id: "step4-monarch-phenodigm",
        source: "monarch_phenodigm",
        step: 4,
        queryTime: t,
        found: false,
        summary: `Monarch/Phenodigm: similarity not computed — ${why} (mouse terms passed to Grok for direct review in Step 5)`,
        raw: { mpTermIds: input.mpTermIds, hpoTermIds: input.hpoTermIds },
      },
      result: empty,
    };
  }

  const resp = await fetchJson<SemsimResp>(MONARCH_SEMSIM, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subjects: input.mpTermIds,
      objects: input.hpoTermIds,
      metric: "ancestor_information_content",
    }),
    timeoutMs: 30_000,
  });

  const matches = Object.values(resp.subject_best_matches ?? {});
  let best: BestMatch | null = null;
  for (const m of matches) {
    if (typeof m.score === "number" && (!best || m.score > (best.score ?? -Infinity))) best = m;
  }

  if (!best) {
    return {
      fragment: {
        id: "step4-monarch-phenodigm",
        source: "monarch_phenodigm",
        step: 4,
        queryTime: t,
        found: false,
        summary: "Monarch/Phenodigm: no similarity match returned between mouse and human terms",
        raw: { mpTermIds: input.mpTermIds, hpoTermIds: input.hpoTermIds },
      },
      result: empty,
    };
  }

  const result: MonarchResult = {
    similarityScore: best.score ?? null,
    phenodigmScore: best.similarity?.phenodigm_score ?? null,
    bestPair: {
      mp: best.match_source ?? "",
      mpLabel: best.match_source_label ?? "",
      hpo: best.match_target ?? "",
      hpoLabel: best.match_target_label ?? "",
    },
  };

  return {
    fragment: {
      id: "step4-monarch-phenodigm",
      source: "monarch_phenodigm",
      step: 4,
      queryTime: t,
      found: true,
      summary: `Monarch/Phenodigm: best mouse↔patient match — '${result.bestPair!.mpLabel}' ↔ '${result.bestPair!.hpoLabel}' (similarity ${result.similarityScore?.toFixed(2)})`,
      raw: { ...result, allMatches: matches.slice(0, 8) },
    },
    result,
  };
}
