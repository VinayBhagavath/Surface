// Step 2 — Variant-Effect Pass (aggregator).
// One MyVariant.info round trip returns ClinVar status, population frequency,
// and the full dbNSFP predictor bundle (AlphaMissense, REVEL, CADD, etc.).
// Emits THREE fragments (all source:"myvariant", distinct ids) so the UI can
// render them as separate cards. Also returns a structured `parsed` object the
// pipeline uses for the early-exit decision and the variant-effect layer.

import { fetchJson, qs } from "@/lib/http";
import type { EvidenceFragment } from "@/lib/types";
import { asArray, firstStr, maxNum, nowIso } from "@/lib/connectors/variant";

const MYVARIANT = "https://myvariant.info/v1";

export type ClinvarStatus =
  | "vus"
  | "pathogenic"
  | "likely_pathogenic"
  | "benign"
  | "likely_benign"
  | "conflicting"
  | "none";

export type MyVariantParsed = {
  clinvarSignificance: string | null;
  clinvarStatus: ClinvarStatus;
  clinvarRecordCount: number;
  alreadyClassified: boolean; // definitively (likely) path/benign -> early-exit candidate
  gnomadAf: number | null;
  gnomadCommon: boolean; // af > 1% -> early-exit signal
  alphamissense: { score: number | null; label: string | null; predRaw: string[] };
  revel: number | null;
  cadd: number | null;
  sift: string | null;
  polyphen: string | null;
  spliceaiMax: number | null;
  perResidue: { gerp: number | null; phyloP: number | null };
};

type Hit = Record<string, unknown>;

function asRecord(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function normSigList(clinvar: unknown): string[] {
  const c = asRecord(clinvar);
  const rcv = asArray(c.rcv);
  const out: string[] = [];
  for (const r of rcv) {
    for (const s of asArray(asRecord(r).clinical_significance)) {
      if (typeof s === "string") out.push(s);
    }
  }
  // some records expose significance at the top level too
  for (const s of asArray(c.clinical_significance)) {
    if (typeof s === "string") out.push(s);
  }
  return out;
}

function classifyClinvar(sigs: string[]): { status: ClinvarStatus; headline: string | null } {
  if (sigs.length === 0) return { status: "none", headline: null };
  const lc = sigs.map((s) => s.toLowerCase());
  const hasUncertain = lc.some((s) => s.includes("uncertain"));
  const hasPath = lc.some((s) => s.includes("pathogenic") && !s.includes("likely"));
  const hasLikelyPath = lc.some((s) => s.includes("likely pathogenic"));
  const hasBenign = lc.some((s) => s.includes("benign") && !s.includes("likely"));
  const hasLikelyBenign = lc.some((s) => s.includes("likely benign"));

  const definitive = hasPath || hasLikelyPath || hasBenign || hasLikelyBenign;
  if (hasUncertain && definitive) return { status: "conflicting", headline: "Uncertain significance (conflicting submissions)" };
  if (hasUncertain) return { status: "vus", headline: "Uncertain significance" };
  if (hasPath) return { status: "pathogenic", headline: "Pathogenic" };
  if (hasLikelyPath) return { status: "likely_pathogenic", headline: "Likely pathogenic" };
  if (hasBenign) return { status: "benign", headline: "Benign" };
  if (hasLikelyBenign) return { status: "likely_benign", headline: "Likely benign" };
  // mixed/other -> conflicting if >1 distinct, else report first
  return { status: "conflicting", headline: sigs[0] };
}

function alphaMissenseLabel(score: number | null): string | null {
  if (score === null) return null;
  if (score >= 0.564) return "likely pathogenic";
  if (score <= 0.34) return "likely benign";
  return "ambiguous";
}

function parseHit(hit: Hit | null): MyVariantParsed {
  const h = asRecord(hit);
  const clinvar = h.clinvar;
  const gnomadGenome = asRecord(h.gnomad_genome);
  const gnomadExome = asRecord(h.gnomad_exome);
  const db = asRecord(h.dbnsfp);
  const alphaMissense = asRecord(db.alphamissense);
  const gerpPlus = asRecord(db["gerp++"]);
  const gerp = asRecord(db.gerp);
  const gerp91 = asRecord(gerp["91_mammals"]);
  const phyloP = asRecord(db.phylop);
  const phyloP100 = asRecord(phyloP["100way_vertebrate"]);
  const spliceObj = asRecord(db.spliceai ?? h.spliceai);
  const revel = asRecord(db.revel);
  const cadd = asRecord(h.cadd);
  const dbCadd = asRecord(db.cadd);
  const sift = asRecord(db.sift);
  const polyphen2 = asRecord(db.polyphen2);
  const hdiv = asRecord(polyphen2.hdiv);
  const sigs = normSigList(clinvar);
  const { status, headline } = classifyClinvar(sigs);

  const af = maxNum([gnomadGenome.af, gnomadExome.af]);

  const amScore = maxNum(alphaMissense.score);
  const gerpScore = maxNum(gerpPlus.rs) ?? maxNum(gerp91.score);
  const phyloPScore = maxNum(phyloP100.score);

  // SpliceAI deltas (present only for some variants/builds)
  const spliceaiMax = Object.keys(spliceObj).length
    ? maxNum([
        spliceObj.dp_ag,
        spliceObj.dp_al,
        spliceObj.dp_dg,
        spliceObj.dp_dl,
        spliceObj.ds_ag,
        spliceObj.ds_al,
        spliceObj.ds_dg,
        spliceObj.ds_dl,
      ])
    : null;

  return {
    clinvarSignificance: headline,
    clinvarStatus: status,
    clinvarRecordCount: asArray(asRecord(clinvar).rcv).length,
    alreadyClassified: ["pathogenic", "likely_pathogenic", "benign", "likely_benign"].includes(status),
    gnomadAf: af,
    gnomadCommon: af !== null && af > 0.01,
    alphamissense: {
      score: amScore,
      label: alphaMissenseLabel(amScore),
      predRaw: asArray(alphaMissense.pred).filter((x): x is string => typeof x === "string"),
    },
    revel: maxNum(revel.score),
    cadd: maxNum(cadd.phred ?? dbCadd.phred),
    sift: firstStr(sift.pred),
    polyphen: firstStr(hdiv.pred),
    spliceaiMax,
    perResidue: { gerp: gerpScore, phyloP: phyloPScore },
  };
}

export async function myvariant(input: {
  variant: string;
  rsId?: string | null;
}): Promise<{ fragments: EvidenceFragment[]; parsed: MyVariantParsed }> {
  const fields =
    "clinvar,dbnsfp,cadd.phred,gnomad_genome.af,gnomad_exome.af,dbsnp.rsid,spliceai";
  const q = input.rsId ? `dbsnp.rsid:${input.rsId}` : input.variant;
  const url = `${MYVARIANT}/query${qs({ q, fields, size: 1 })}`;

  const resp = await fetchJson<{ hits?: Hit[] }>(url, { timeoutMs: 25_000 });
  const hit = resp.hits?.[0] ?? null;
  const parsed = parseHit(hit);
  const t = nowIso();

  // ── Fragment 1: ClinVar ──────────────────────────────────────────────────
  const clinvarFound = parsed.clinvarStatus !== "none";
  const clinvarFragment: EvidenceFragment = {
    id: "step2-myvariant-clinvar",
    source: "myvariant",
    step: 2,
    queryTime: t,
    found: clinvarFound,
    summary: clinvarFound
      ? `ClinVar: classified as '${parsed.clinvarSignificance}' (${parsed.clinvarRecordCount} record${parsed.clinvarRecordCount === 1 ? "" : "s"})`
      : "ClinVar: no record found for this variant",
    raw: {
      status: parsed.clinvarStatus,
      significance: parsed.clinvarSignificance,
      alreadyClassified: parsed.alreadyClassified,
      recordCount: parsed.clinvarRecordCount,
    },
  };

  // ── Fragment 2: gnomAD population frequency ──────────────────────────────
  const freqDesc =
    parsed.gnomadAf === null
      ? "not observed in population databases"
      : parsed.gnomadCommon
        ? `${parsed.gnomadAf.toExponential(2)} (COMMON — too frequent for a highly penetrant disorder)`
        : `${parsed.gnomadAf.toExponential(2)} (rare)`;
  const gnomadFragment: EvidenceFragment = {
    id: "step2-myvariant-gnomad-freq",
    source: "myvariant",
    step: 2,
    queryTime: t,
    found: true, // a real query ran; absence is itself a meaningful result
    summary: `gnomAD: allele frequency ${freqDesc}`,
    relevance: parsed.gnomadCommon ? "high" : "medium",
    raw: { af: parsed.gnomadAf, common: parsed.gnomadCommon },
  };

  // ── Fragment 3: dbNSFP in-silico predictors ──────────────────────────────
  const amStr =
    parsed.alphamissense.score !== null
      ? `AlphaMissense ${parsed.alphamissense.score.toFixed(2)} (${parsed.alphamissense.label})`
      : "AlphaMissense n/a";
  const parts = [
    amStr,
    parsed.revel !== null ? `REVEL ${parsed.revel.toFixed(2)}` : null,
    parsed.cadd !== null ? `CADD ${parsed.cadd.toFixed(1)}` : null,
    parsed.spliceaiMax !== null ? `SpliceAI Δ ${parsed.spliceaiMax.toFixed(2)}` : null,
  ].filter(Boolean);
  const predictorsFound = parsed.alphamissense.score !== null || parsed.revel !== null || parsed.cadd !== null;
  const dbnsfpFragment: EvidenceFragment = {
    id: "step2-myvariant-dbnsfp",
    source: "myvariant",
    step: 2,
    queryTime: t,
    found: predictorsFound,
    summary: predictorsFound
      ? `In-silico predictors: ${parts.join(", ")}`
      : "In-silico predictors: none available for this variant",
    raw: {
      alphamissense: parsed.alphamissense,
      revel: parsed.revel,
      cadd: parsed.cadd,
      sift: parsed.sift,
      polyphen: parsed.polyphen,
      spliceaiMax: parsed.spliceaiMax,
      perResidueConservation: parsed.perResidue,
    },
  };

  return { fragments: [clinvarFragment, gnomadFragment, dbnsfpFragment], parsed };
}
