// /fixtures/gate-closed-run.ts
// DEV SCAFFOLD — the demo's differentiating run. NOT shipped mock data; replaced by the
// live Inngest Realtime subscription at integration. No casts.
//
// Scenario: SCN8A missense at a recurrent gain-of-function hotspot (representative
// p.Arg1872Trp), neurodevelopmental context. The variant looks damaging AND the mouse
// knockout shows a DRAMATIC phenotype (strong Cross-Species) — but the gene causes disease
// by GAIN-of-function, which a knockout can't model. The Mechanism Gate CLOSES (~0.10),
// correctly suppressing the cross-species signal; overall is LOW.

import type { RealtimeEvent } from "@/lib/types";

export const gateClosedRun: RealtimeEvent[] = [
  {
    type: "fragment",
    data: {
      id: "vep-1",
      source: "ensembl_vep",
      step: 0,
      queryTime: "2026-06-13T17:10:01.000Z",
      found: true,
      summary: "Missense variant — checking AlphaMissense and conservation first.",
      raw: { consequence: "missense_variant", hgvsp: "p.Arg1872Trp", gene: "SCN8A" },
    },
  },
  {
    type: "fragment",
    data: {
      id: "gnomad-constraint-1",
      source: "gnomad_constraint",
      step: 1,
      queryTime: "2026-06-13T17:10:02.000Z",
      found: true,
      summary: "SCN8A is highly constrained (LOEUF 0.18, pLI 1.0).",
      raw: { gene: "SCN8A", loeuf: 0.18, pli: 1.0 },
    },
  },
  {
    type: "pipeline_update",
    data: {
      genePrior: {
        value: 0.86,
        label: "high",
        reason: "SCN8A is highly constrained against loss-of-function.",
      },
      variantEffect: null,
      mechanismGate: null,
      crossSpecies: null,
      overall: null,
    },
  },
  {
    type: "narration",
    data: "No clear human verdict yet, so I'll look at the mouse — but first, does this specific change look damaging, and how does it act?",
  },
  {
    type: "fragment",
    data: {
      id: "myvariant-clinvar-1",
      source: "myvariant",
      step: 2,
      queryTime: "2026-06-13T17:10:04.000Z",
      found: true,
      summary: "ClinVar: Uncertain significance, conflicting submissions.",
      raw: {
        clinvar: {
          clinical_significance: "Uncertain significance",
          review_status: "conflicting interpretations",
        },
      },
      relevance: "high",
    },
  },
  {
    type: "fragment",
    data: {
      id: "myvariant-gnomad-1",
      source: "myvariant",
      step: 2,
      queryTime: "2026-06-13T17:10:05.000Z",
      found: true,
      summary: "Absent from gnomAD population controls.",
      raw: { gnomad: { af: 0, ac: 0, an: 251000 } },
      relevance: "medium",
    },
  },
  {
    type: "fragment",
    data: {
      id: "myvariant-alphamissense-1",
      source: "myvariant",
      step: 2,
      queryTime: "2026-06-13T17:10:06.000Z",
      found: true,
      summary: "AlphaMissense: likely pathogenic (0.93).",
      raw: { alphamissense: { score: 0.931, class: "likely_pathogenic" } },
      relevance: "high",
    },
  },
  {
    type: "fragment",
    data: {
      id: "conservation-1",
      source: "ensembl_conservation",
      step: 2,
      queryTime: "2026-06-13T17:10:07.000Z",
      found: true,
      summary: "Residue is highly conserved (GERP 5.9); sits in a known GoF hotspot.",
      raw: { gerp: 5.9, phylop: 8.2, note: "recurrent gain-of-function residue" },
      relevance: "high",
    },
  },
  {
    type: "pipeline_update",
    data: {
      genePrior: {
        value: 0.86,
        label: "high",
        reason: "SCN8A is highly constrained against loss-of-function.",
      },
      variantEffect: {
        value: 0.8,
        label: "high",
        reason: "AlphaMissense likely-pathogenic at a conserved residue.",
      },
      mechanismGate: null,
      crossSpecies: null,
      overall: null,
    },
  },
  {
    type: "narration",
    data: "The change looks damaging — but this residue is a recurrent gain-of-function hotspot. A knockout removes the gene; it can't tell us what an over-active channel does.",
  },
  {
    type: "pipeline_update",
    data: {
      genePrior: {
        value: 0.86,
        label: "high",
        reason: "SCN8A is highly constrained against loss-of-function.",
      },
      variantEffect: {
        value: 0.8,
        label: "high",
        reason: "AlphaMissense likely-pathogenic at a conserved residue.",
      },
      mechanismGate: {
        value: 0.1,
        reason: "Gene causes disease by gain-of-function; a knockout can't speak to that.",
      },
      crossSpecies: null,
      overall: null,
    },
  },
  {
    type: "fragment",
    data: {
      id: "diopt-1",
      source: "ensembl_diopt",
      step: 4,
      queryTime: "2026-06-13T17:10:10.000Z",
      found: true,
      summary: "Clean 1:1 mouse ortholog Scn8a (DIOPT 15/15, 94% identity).",
      raw: { ortholog: "Scn8a", diopt_score: 15, max_score: 15, percent_identity: 94 },
      relevance: "medium",
    },
  },
  {
    type: "fragment",
    data: {
      id: "impc-1",
      source: "impc",
      step: 4,
      queryTime: "2026-06-13T17:10:11.000Z",
      found: true,
      summary: "Mouse Scn8a knockout has a dramatic neuro phenotype (tremor, ataxia, early lethality).",
      raw: {
        allele: "Scn8a<med>",
        phenotypes: ["tremor", "ataxia", "progressive paralysis"],
        viability: "homozygous lethal",
      },
      relevance: "high",
    },
  },
  {
    type: "fragment",
    data: {
      id: "monarch-1",
      source: "monarch_phenodigm",
      step: 4,
      queryTime: "2026-06-13T17:10:12.000Z",
      found: true,
      summary: "High MP↔HPO similarity to the patient's neuro phenotype (phenodigm 81).",
      raw: { phenodigm_score: 81.2, top_hpo: ["HP:0001250 Seizure", "HP:0001332 Dystonia"] },
      relevance: "high",
    },
  },
  {
    type: "pipeline_update",
    data: {
      genePrior: {
        value: 0.86,
        label: "high",
        reason: "SCN8A is highly constrained against loss-of-function.",
      },
      variantEffect: {
        value: 0.8,
        label: "high",
        reason: "AlphaMissense likely-pathogenic at a conserved residue.",
      },
      mechanismGate: {
        value: 0.1,
        reason: "Gene causes disease by gain-of-function; a knockout can't speak to that.",
      },
      crossSpecies: {
        value: 0.9,
        label: "high",
        reason: "Dramatic mouse knockout phenotype with high phenotype similarity.",
      },
      overall: null,
    },
  },
  {
    type: "narration",
    data: "The mouse knockout signal is dramatic — but it's the wrong kind of evidence here. Because this is gain-of-function, I'm discounting it rather than letting it inflate confidence.",
  },
  {
    type: "pipeline_update",
    data: {
      genePrior: {
        value: 0.86,
        label: "high",
        reason: "SCN8A is highly constrained against loss-of-function.",
      },
      variantEffect: {
        value: 0.8,
        label: "high",
        reason: "AlphaMissense likely-pathogenic at a conserved residue.",
      },
      mechanismGate: {
        value: 0.1,
        reason: "Gene causes disease by gain-of-function; a knockout can't speak to that.",
      },
      crossSpecies: {
        value: 0.9,
        label: "high",
        reason: "Dramatic mouse knockout phenotype with high phenotype similarity.",
      },
      overall: {
        label: "low",
        reason:
          "The dramatic cross-species signal was correctly suppressed: a knockout can't model a gain-of-function variant.",
      },
    },
  },
  {
    type: "complete",
    briefUrl: "/brief/scn8a-demo",
  },
];
