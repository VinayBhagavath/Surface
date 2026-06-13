// ─────────────────────────────────────────────────────────────────────────────
// Evidence pipeline orchestrator (Steps 0–6).
//
// This is the single source of truth for the research flow. It is abstracted
// over two dependencies so the SAME code runs in two places with no drift:
//   • the Inngest function  → runStep = step.run (durable, retried),
//                             publish = Inngest Realtime publish (wrapped in a step)
//   • the local runner/      → runStep = (n,fn)=>fn(), publish = push to an array
//     fixture capture          (captures the exact RealtimeEvent[] for Person B)
//
// Every external call is a runStep; every UI-facing event goes through publish.
// ─────────────────────────────────────────────────────────────────────────────

import {
  ensemblVep,
  gnomadConstraint,
  myvariant,
  ensemblConservation,
  ensemblDiopt,
  impc,
  monarch,
  searchLiterature,
} from "@/lib/connectors";
import {
  getGeneMechanism,
  zygosityForInheritance,
  hpoTermsForContext,
  contextLabel as contextPhrase,
} from "@/lib/reference";
import { PS3_MODEL_ORGANISM_CAVEAT } from "@/lib/reference/acmg";
import {
  predictorLeadership,
  mechanismGate,
  crossSpeciesCheck,
  synthesis,
  researchGeneMechanism,
} from "@/lib/grok";
import { webSearchEnabled } from "@/lib/env";
import {
  predictorLeadershipFallback,
  mechanismGateFallback,
  crossSpeciesFallback,
  synthesisFallback,
} from "@/lib/grok/fallbacks";
import {
  computeLayeredConfidence,
  type LayeredConfidenceInput,
} from "@/lib/confidence/layered-model";
import { saveOutput, saveSnapshot, registerWatch, type WatchSnapshot } from "@/lib/store";
import { BRIEF_URL_BASE, WATCH_CRON } from "@/lib/pipeline/config";
import type {
  AcmgRow,
  ConfidenceLabel,
  ConfidencePipelineState,
  DoctorBrief,
  EvidenceCard,
  EvidenceFragment,
  EvidenceRequestedData,
  RealtimeEvent,
  RunOutput,
} from "@/lib/types";

export type StepRunner = <T>(name: string, fn: () => Promise<T>) => Promise<T>;
export type Publisher = (key: string, event: RealtimeEvent) => Promise<void>;

export type PipelineDeps = {
  runStep: StepRunner;
  publish: Publisher;
  registerWatcher?: boolean; // default true
  briefUrlBase?: string; // default "/brief"
};

export async function runEvidencePipeline(
  input: EvidenceRequestedData,
  deps: PipelineDeps,
): Promise<RunOutput> {
  const { runStep, publish } = deps;
  const briefBase = deps.briefUrlBase ?? BRIEF_URL_BASE;
  const briefUrl = `${briefBase}/${input.runId}`;

  const fragments: EvidenceFragment[] = [];
  const trajectory: string[] = [];
  const seenIds = new Set<string>();

  const emitFragment = async (key: string, f: EvidenceFragment) => {
    fragments.push(f);
    if (!seenIds.has(f.id)) {
      seenIds.add(f.id);
      trajectory.push(f.summary);
    }
    await publish(key, { type: "fragment", data: f });
  };
  const emitNarration = (key: string, text: string) =>
    publish(key, { type: "narration", data: text });
  const emitPipeline = (key: string, state: ConfidencePipelineState) =>
    publish(key, { type: "pipeline_update", data: state });

  // Running confidence inputs, filled in layer-by-layer.
  const ci: LayeredConfidenceInput = {
    genePrior: null,
    variantEffect: null,
    mechanismGate: null,
    crossSpecies: null,
  };

  await emitNarration("n-start", "Starting the investigation — gathering what's known about this variant.");

  // ── Step 0 — VEP router ────────────────────────────────────────────────────
  const { fragment: vepFrag, resolved } = await runStep("step0-vep", () =>
    ensemblVep({ variant: input.variant }),
  );
  await emitFragment("f-vep", vepFrag);
  const gene = resolved.geneSymbol;

  if (!gene || !vepFrag.found) {
    const out = buildUnresolvedOutput(input);
    await runStep("save-unresolved", async () => (await saveOutput(input.runId, out), null));
    await emitNarration("n-unresolved", "I couldn't resolve this variant to a gene, so I can't investigate further — please double-check the notation.");
    await publish("c-unresolved", { type: "complete", briefUrl });
    return out;
  }
  await emitNarration(
    "n-vep",
    `This is a ${resolved.mostSevereConsequence?.replace(/_/g, " ")} in ${gene}. I'll check the human evidence first, then look across species.`,
  );

  // ── Step 1 (constraint) + Step 2 (MyVariant) in parallel ───────────────────
  const [constraintFrag, mv] = await Promise.all([
    runStep("step1-constraint", () => gnomadConstraint({ geneSymbol: gene })),
    runStep("step2-myvariant", () => myvariant({ variant: input.variant, rsId: resolved.rsId })),
  ]);
  await emitFragment("f-constraint", constraintFrag);
  for (let i = 0; i < mv.fragments.length; i++) await emitFragment(`f-mv-${i}`, mv.fragments[i]);

  // Conservation depends on MyVariant's per-residue scores → runs just after.
  const consFrag = await runStep("step2-conservation", () =>
    ensemblConservation({
      chrom: resolved.chrom,
      pos: resolved.pos,
      geneSymbol: gene,
      perResidueGerp: mv.parsed.perResidue.gerp,
      perResiduePhyloP: mv.parsed.perResidue.phyloP,
    }),
  );
  await emitFragment("f-cons", consFrag);

  // gene-prior layer
  const cr = constraintFrag.raw as { loeuf?: number | null; pli?: number | null; misZ?: number | null };
  ci.genePrior = { loeuf: cr.loeuf ?? null, pli: cr.pli ?? null, misZ: cr.misZ ?? null };
  await emitPipeline("p-geneprior", withoutOverall(computeLayeredConfidence(ci)));

  // ── Early-exit check (Step after 0/1/2) ────────────────────────────────────
  if (mv.parsed.alreadyClassified || mv.parsed.gnomadCommon) {
    const out = buildEarlyExitOutput(input, gene, mv.parsed, fragments, computeLayeredConfidence(ci));
    await runStep("save-early", async () => (await saveOutput(input.runId, out), null));
    await emitNarration("n-early", earlyNarration(mv.parsed));
    await emitPipeline("p-early", out.evidenceCard.pipeline);
    await publish("c-early", { type: "complete", briefUrl });
    return out;
  }
  await emitNarration("n-no-human", "No conclusive human-only answer — checking what's known in mice.");

  // ── Step 2 Grok — predictor leadership + disagreement ──────────────────────
  const csElementScore = (consFrag.raw as { elementScore?: number | null }).elementScore ?? null;
  const predictorInput = {
    geneSymbol: gene,
    consequenceClass: resolved.consequenceClass,
    alphamissense: mv.parsed.alphamissense,
    revel: mv.parsed.revel,
    cadd: mv.parsed.cadd,
    spliceaiMax: mv.parsed.spliceaiMax,
    sift: mv.parsed.sift,
    polyphen: mv.parsed.polyphen,
    conservation: { elementScore: csElementScore, gerp: mv.parsed.perResidue.gerp, phyloP: mv.parsed.perResidue.phyloP },
  };
  let pred: Awaited<ReturnType<typeof predictorLeadership>>;
  try {
    pred = await runStep("grok-predictor", () => predictorLeadership(predictorInput));
  } catch (e) {
    console.warn("[pipeline] predictor reasoning degraded:", (e as Error).message);
    pred = predictorLeadershipFallback(predictorInput);
  }
  await emitNarration("n-pred", pred.disagreementNote ? `One thing to flag: ${pred.disagreementNote}` : pred.interpretation);

  ci.variantEffect = {
    direction: pred.direction,
    agreement: pred.agreement,
    alphamissense: mv.parsed.alphamissense.score,
    revel: mv.parsed.revel,
    cadd: mv.parsed.cadd,
    conservationSupport: pred.conservationSupport,
    headlinePredictor: pred.headlinePredictor,
  };
  await emitPipeline("p-variant", withoutOverall(computeLayeredConfidence(ci)));

  // ── Step 3 Grok — Mechanism-Compatibility Gate ─────────────────────────────
  let mech = getGeneMechanism(gene);
  // Out-of-table gene → research its established mechanism via xAI Live Search
  // (cited + labeled), so the gate is set from real literature instead of the
  // conservative default. Strictly additive: disabled/empty/error keeps the
  // cautious behaviour and never invents a mechanism.
  if (!mech && webSearchEnabled()) {
    const research = await runStep("grok-mech-research", async () => {
      try {
        return await researchGeneMechanism({ geneSymbol: gene, clinicalContext: input.clinicalContext });
      } catch (e) {
        console.warn("[pipeline] mechanism research failed:", (e as Error).message);
        return null;
      }
    });
    if (research && research.data.found && research.data.mechanism !== "unknown") {
      mech = {
        mechanism: research.data.mechanism,
        inheritanceMode: research.data.inheritanceMode === "unknown" ? "both" : research.data.inheritanceMode,
        notes: `[Mechanism researched from published literature — not the curated table] ${research.data.rationale}`,
        source: "Live Search (xAI web_search)",
      };
      const cites = research.citations.slice(0, 2).map((c) => c.title ?? c.url).join("; ");
      await emitNarration(
        "n-mech-research",
        `${gene} isn't in our curated mechanism table, so I researched it: ${research.data.rationale}` +
          (cites ? ` (sources: ${cites})` : ""),
      );
      trajectory.push(
        `Researched mechanism for ${gene} (${research.data.mechanism}) from literature: ${research.data.rationale}` +
          (research.citations.length ? ` [${research.citations.map((c) => c.url).join(", ")}]` : ""),
      );
    }
  }
  const gateInput = {
    geneSymbol: gene,
    consequenceClass: resolved.consequenceClass,
    predictorDirection: pred.direction,
    conservationSupport: pred.conservationSupport,
    geneConstraint: { loeuf: ci.genePrior!.loeuf, pli: ci.genePrior!.pli, misZ: ci.genePrior!.misZ },
    geneMechanism: mech ? { mechanism: mech.mechanism, inheritanceMode: mech.inheritanceMode, notes: mech.notes } : null,
  };
  let gate: Awaited<ReturnType<typeof mechanismGate>>;
  try {
    gate = await runStep("grok-gate", () => mechanismGate(gateInput));
  } catch (e) {
    console.warn("[pipeline] mechanism-gate reasoning degraded:", (e as Error).message);
    gate = mechanismGateFallback();
  }
  ci.mechanismGate = { value: gate.gate, reason: gate.reason };
  await emitNarration(
    "n-gate",
    gate.gate < 0.4
      ? `Flagging upfront: ${gate.reason} I'll still check the mouse data for completeness, but it's unlikely to count for much here.`
      : gate.reason,
  );
  await emitPipeline("p-gate", withoutOverall(computeLayeredConfidence(ci)));

  // ── Step 4 — Cross-species fan-out (ortholog → IMPC → Monarch) ─────────────
  const { fragment: dioptFrag, ortholog } = await runStep("step4-diopt", () =>
    ensemblDiopt({ geneSymbol: gene }),
  );
  await emitFragment("f-diopt", dioptFrag);

  const zyg = zygosityForInheritance(mech?.inheritanceMode ?? null);
  let impcFrags: EvidenceFragment[] = [];
  let impcResult = { mpTermIds: [] as string[], phenotypeCount: 0, lethal: false, lethalPhenotype: null as string | null };
  if (ortholog.mouseGeneSymbol) {
    const r = await runStep("step4-impc", () => impc({ mouseGeneSymbol: ortholog.mouseGeneSymbol as string, zygosity: zyg }));
    impcFrags = r.fragments;
    impcResult = r.result;
    for (let i = 0; i < impcFrags.length; i++) await emitFragment(`f-impc-${i}`, impcFrags[i]);
  } else {
    const f: EvidenceFragment = {
      id: "step4-impc-none",
      source: "impc",
      step: 4,
      queryTime: new Date().toISOString(),
      found: false,
      relevance: "unscored",
      summary: `IMPC: skipped — no mouse ortholog resolved for ${gene}`,
      raw: {},
    };
    impcFrags = [f];
    await emitFragment("f-impc-none", f);
  }

  const hpo = hpoTermsForContext(input.clinicalContext);
  const mon = await runStep("step4-monarch", () => monarch({ mpTermIds: impcResult.mpTermIds, hpoTermIds: hpo }));
  await emitFragment("f-monarch", mon.fragment);

  // ── Step 5 Grok — cross-species sanity check + relevance assignment ────────
  const impcForGrok = impcFrags
    .filter((f) => f.found)
    .map((f) => ({
      id: f.id,
      summary: f.summary,
      mpTermName: ((f.raw as { mp_term_name?: string }).mp_term_name) ?? null,
      lethal: Boolean((f.raw as { viabilityLethal?: boolean }).viabilityLethal),
    }));
  const crossInput = {
    geneSymbol: gene,
    clinicalContext: input.clinicalContext,
    hpoTerms: hpo,
    orthologQuality: ortholog.quality,
    monarch: {
      found: mon.fragment.found,
      similarityScore: mon.result.similarityScore,
      bestPair: mon.result.bestPair
        ? { mpLabel: mon.result.bestPair.mpLabel, hpoLabel: mon.result.bestPair.hpoLabel }
        : null,
    },
    impcFragments: impcForGrok,
    lethal: impcResult.lethal,
  };
  let cross: Awaited<ReturnType<typeof crossSpeciesCheck>>;
  try {
    cross = await runStep("grok-crossspecies", () => crossSpeciesCheck(crossInput));
  } catch (e) {
    console.warn("[pipeline] cross-species reasoning degraded:", (e as Error).message);
    cross = crossSpeciesFallback({
      monarchSimilarity: mon.result.similarityScore,
      lethal: impcResult.lethal,
      anyImpcFound: impcFrags.some((f) => f.found),
    });
  }
  await emitNarration("n-cross", cross.narration);

  // Re-publish IMPC fragments with Grok-assigned relevance (UI treats as update).
  for (let i = 0; i < impcFrags.length; i++) {
    const rel = cross.relevanceById[impcFrags[i].id];
    if (rel) await emitFragment(`f-impc-rel-${i}`, { ...impcFrags[i], relevance: rel });
  }

  ci.crossSpecies = {
    orthologQuality: ortholog.quality,
    monarchSimilarity: mon.result.similarityScore,
    lethal: impcResult.lethal,
    maxRelevance: bestRelevance(Object.values(cross.relevanceById)),
    strength: cross.crossSpeciesStrength,
    found: impcFrags.some((f) => f.found),
  };

  // ── Step 5b — scholarly literature pass (Europe PMC) ───────────────────────
  // Real published papers for this gene + condition, so the synthesis is
  // grounded in literature, not just database records. Best-effort: a failure
  // here never blocks synthesis.
  const lit = await runStep("step5-literature", async () => {
    try {
      return await searchLiterature({
        geneSymbol: gene,
        condition: contextPhrase(input.clinicalContext),
        limit: 4,
      });
    } catch {
      return { found: false, count: 0, query: "", papers: [] };
    }
  });
  if (lit.found) {
    const litFrag: EvidenceFragment = {
      id: "step5-literature",
      source: "monarch_phenodigm", // reuse an existing source slot (contract-stable)
      step: 5,
      queryTime: new Date().toISOString(),
      found: true,
      relevance: "unscored",
      summary: `Literature: ${lit.count.toLocaleString()} papers on ${gene} + ${contextPhrase(
        input.clinicalContext,
      )}; most relevant: "${lit.papers[0]?.title ?? ""}"`,
      raw: { query: lit.query, count: lit.count, papers: lit.papers },
    };
    await emitFragment("f-literature", litFrag);
    await emitNarration(
      "n-literature",
      `I also pulled the published research — ${lit.count.toLocaleString()} papers on ${gene} and this condition — to ground the conclusion.`,
    );
    for (const p of lit.papers) {
      trajectory.push(`Literature: "${p.title}" (${p.journal ?? "?"}, ${p.year ?? "?"})`);
    }
  }

  // ── Step 6 — layered confidence + synthesis ────────────────────────────────
  const pipeline = computeLayeredConfidence(ci);
  const overall: ConfidenceLabel = pipeline.overall?.label ?? "low";
  await emitPipeline("p-prefinal", pipeline);

  const predictorAgreement =
    pred.agreement === "disagree"
      ? pred.disagreementNote ?? "predictors disagree on direction"
      : pred.agreement === "mixed"
        ? "predictors are mixed"
        : "predictors agree on direction";
  const lethalitySignal = impcResult.lethal
    ? `Mouse knockout is ${impcResult.lethalPhenotype} — an essentiality signal${gate.gate < 0.4 ? ", but suppressed by the mechanism gate" : ""}.`
    : null;

  const synthesisInput = {
    geneSymbol: gene,
    variant: input.variant,
    proteinChange: resolved.proteinChange,
    clinicalContext: input.clinicalContext,
    computedOverall: overall,
    pipeline,
    trajectory,
    predictorAgreement,
    lethalitySignal,
    mechanism: mech ? { mechanism: mech.mechanism, inheritanceMode: mech.inheritanceMode, notes: mech.notes } : null,
  };
  let syn: Awaited<ReturnType<typeof synthesis>>;
  try {
    syn = await runStep("grok-synthesis", () => synthesis(synthesisInput));
  } catch (e) {
    console.warn("[pipeline] synthesis reasoning degraded:", (e as Error).message);
    syn = synthesisFallback({
      geneSymbol: gene,
      variant: input.variant,
      clinicalContext: input.clinicalContext,
      computedOverall: overall,
      pipeline,
    });
  }

  const acmgRows: AcmgRow[] = syn.acmgRows.map((r) =>
    r.code.toUpperCase().startsWith("PS3") ? { ...r, caveat: PS3_MODEL_ORGANISM_CAVEAT } : r,
  );

  const generatedAt = new Date().toISOString();
  const evidenceCard: EvidenceCard = {
    runId: input.runId,
    variant: input.variant,
    geneSymbol: gene,
    clinicalContext: input.clinicalContext,
    fragments: dedupeById(fragments),
    pipeline,
    plainLanguageSummary: syn.plainLanguageSummary,
    predictorAgreement,
    lethalitySignal,
    generatedAt,
  };
  const doctorBrief: DoctorBrief = {
    runId: input.runId,
    variant: input.variant,
    geneSymbol: gene,
    clinicalContext: input.clinicalContext,
    overall,
    summary: syn.briefSummary,
    perLayerReasons: {
      genePrior: pipeline.genePrior?.reason ?? "n/a",
      variantEffect: pipeline.variantEffect?.reason ?? "n/a",
      mechanismGate: pipeline.mechanismGate?.reason ?? "n/a",
      crossSpecies: pipeline.crossSpecies?.reason ?? "n/a",
    },
    acmgRows,
    whatWouldChangeThis: overall === "high" ? null : syn.whatWouldChangeThis,
    suggestedFollowUp: overall === "low" ? null : syn.suggestedFollowUp,
    generatedAt,
  };
  const out: RunOutput = { evidenceCard, doctorBrief };

  await runStep("save-output", async () => (await saveOutput(input.runId, out), null));

  // ── Watcher registration ───────────────────────────────────────────────────
  if (deps.registerWatcher !== false) {
    const snapshot: WatchSnapshot = {
      runId: input.runId,
      variant: input.variant,
      geneSymbol: gene,
      mouseGeneSymbol: ortholog.mouseGeneSymbol,
      clinvarSignificance: mv.parsed.clinvarSignificance,
      impcPhenotypeCount: impcResult.phenotypeCount,
      impcMpTermIds: impcResult.mpTermIds,
      overall,
      takenAt: generatedAt,
    };
    await runStep("save-snapshot", async () => (await saveSnapshot(snapshot), null));
    await runStep("register-watch", async () =>
      (await registerWatch({
        runId: input.runId,
        variant: input.variant,
        geneSymbol: gene,
        clinicalContext: input.clinicalContext,
        intervalCron: WATCH_CRON,
        registeredAt: generatedAt,
        lastCheckedAt: null,
        lastResult: null,
        changeFound: false,
      }),
      null),
    );
  }

  await emitNarration("n-synth", syn.plainLanguageSummary);
  await emitPipeline("p-final", pipeline);
  await publish("c-complete", { type: "complete", briefUrl });
  return out;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function withoutOverall(s: ConfidencePipelineState): ConfidencePipelineState {
  return { ...s, overall: null };
}

function bestRelevance(vals: string[]): "high" | "medium" | "low" | null {
  if (vals.includes("high")) return "high";
  if (vals.includes("medium")) return "medium";
  if (vals.includes("low")) return "low";
  return null;
}

function dedupeById(frags: EvidenceFragment[]): EvidenceFragment[] {
  const m = new Map<string, EvidenceFragment>();
  for (const f of frags) m.set(f.id, f); // last write wins (updated relevance)
  return [...m.values()];
}

function earlyNarration(p: { gnomadCommon: boolean; alreadyClassified: boolean; clinvarSignificance: string | null; gnomadAf: number | null }): string {
  if (p.gnomadCommon)
    return `This variant is actually common in the general population (allele frequency ${p.gnomadAf?.toExponential(2)}) — too frequent to be a highly penetrant cause of disease, so the deeper cross-species investigation isn't warranted here.`;
  return `This variant is already classified in ClinVar as '${p.clinvarSignificance}', so it isn't currently a variant of uncertain significance — here's the direct finding.`;
}

function buildEarlyExitOutput(
  input: EvidenceRequestedData,
  gene: string,
  parsed: { gnomadCommon: boolean; alreadyClassified: boolean; clinvarStatus: string; clinvarSignificance: string | null; gnomadAf: number | null },
  fragments: EvidenceFragment[],
  base: ConfidencePipelineState,
): RunOutput {
  const generatedAt = new Date().toISOString();
  const benignDirection = parsed.gnomadCommon || parsed.clinvarStatus.includes("benign");
  const overall: ConfidenceLabel = benignDirection ? "low" : "high";

  const summary = parsed.gnomadCommon
    ? `${gene} ${input.variant} is common in the population (allele frequency ${parsed.gnomadAf?.toExponential(2)}), which is too frequent for a highly penetrant disorder. The uncertainty here likely doesn't warrant a deep cross-species investigation.`
    : `${gene} ${input.variant} is already classified in ClinVar as '${parsed.clinvarSignificance}'. It is not currently a variant of uncertain significance.`;

  const acmgRows: AcmgRow[] = parsed.gnomadCommon
    ? [{ code: "BA1", direction: "benign", strength: "stand-alone", fact: `Allele frequency ${parsed.gnomadAf?.toExponential(2)} is too high for a highly penetrant disorder.` }]
    : [];

  const pipeline: ConfidencePipelineState = {
    ...base,
    crossSpecies: null,
    overall: { label: overall, reason: summary },
  };

  const evidenceCard: EvidenceCard = {
    runId: input.runId,
    variant: input.variant,
    geneSymbol: gene,
    clinicalContext: input.clinicalContext,
    fragments: dedupeById(fragments),
    pipeline,
    plainLanguageSummary: summary,
    predictorAgreement: null,
    lethalitySignal: null,
    generatedAt,
  };
  const doctorBrief: DoctorBrief = {
    runId: input.runId,
    variant: input.variant,
    geneSymbol: gene,
    clinicalContext: input.clinicalContext,
    overall,
    summary,
    perLayerReasons: {
      genePrior: pipeline.genePrior?.reason ?? "n/a",
      variantEffect: "Not assessed — resolved at the human-evidence stage (early exit).",
      mechanismGate: "Not assessed — early exit.",
      crossSpecies: "Not assessed — early exit.",
    },
    acmgRows,
    whatWouldChangeThis: benignDirection ? "A new rare/segregating observation or a reclassification in ClinVar would reopen the investigation." : null,
    suggestedFollowUp: benignDirection ? null : "Confirm the existing ClinVar classification with your clinical team.",
    generatedAt,
  };
  return { evidenceCard, doctorBrief };
}

function buildUnresolvedOutput(input: EvidenceRequestedData): RunOutput {
  const generatedAt = new Date().toISOString();
  const summary = `Could not resolve "${input.variant}" to a gene/consequence via Ensembl VEP. Please check the HGVS notation or rsID.`;
  const pipeline: ConfidencePipelineState = {
    genePrior: null,
    variantEffect: null,
    mechanismGate: null,
    crossSpecies: null,
    overall: { label: "low", reason: summary },
  };
  const evidenceCard: EvidenceCard = {
    runId: input.runId,
    variant: input.variant,
    geneSymbol: "",
    clinicalContext: input.clinicalContext,
    fragments: [],
    pipeline,
    plainLanguageSummary: summary,
    predictorAgreement: null,
    lethalitySignal: null,
    generatedAt,
  };
  const doctorBrief: DoctorBrief = {
    runId: input.runId,
    variant: input.variant,
    geneSymbol: "",
    clinicalContext: input.clinicalContext,
    overall: "low",
    summary,
    perLayerReasons: { genePrior: "n/a", variantEffect: "n/a", mechanismGate: "n/a", crossSpecies: "n/a" },
    acmgRows: [],
    whatWouldChangeThis: "A resolvable variant identifier (valid HGVS or rsID).",
    suggestedFollowUp: null,
    generatedAt,
  };
  return { evidenceCard, doctorBrief };
}
