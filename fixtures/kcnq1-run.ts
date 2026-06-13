// /fixtures/kcnq1-run.ts
// DEV SCAFFOLD — a hand-built, captured-shape sample run used to build the UI before
// Person A's live pipeline exists. NOT shipped mock data: at integration this is replaced
// by the live Inngest Realtime subscription (same RealtimeEvent[] shape). No casts.
//
// Scenario: KCNQ1 missense (representative p.Arg190Trp), cardiac / arrhythmia context.
// The "everything agrees" run — the Mechanism Gate is OPEN (~0.95), overall HIGH.
//
// pipeline_update events carry the CUMULATIVE ConfidencePipelineState (known fields set,
// the rest null); the run hook merges them field-by-field (non-null wins).

import type { RealtimeEvent } from "@/lib/types";

export const kcnq1Run: RealtimeEvent[] = [
  {
    type: "fragment",
    data: {
      id: "vep-1",
      source: "ensembl_vep",
      step: 0,
      queryTime: "2026-06-13T17:00:01.000Z",
      found: true,
      summary: "Missense variant — checking AlphaMissense and conservation first.",
      raw: { consequence: "missense_variant", hgvsp: "p.Arg190Trp", gene: "KCNQ1" },
    },
  },
  {
    type: "fragment",
    data: {
      id: "gnomad-constraint-1",
      source: "gnomad_constraint",
      step: 1,
      queryTime: "2026-06-13T17:00:02.000Z",
      found: true,
      summary: "KCNQ1 is loss-of-function intolerant (LOEUF 0.21, pLI 0.98).",
      raw: { gene: "KCNQ1", loeuf: 0.21, pli: 0.98 },
    },
  },
  {
    type: "pipeline_update",
    data: {
      genePrior: {
        value: 0.85,
        label: "high",
        reason: "KCNQ1 is strongly loss-of-function intolerant.",
      },
      variantEffect: null,
      mechanismGate: null,
      crossSpecies: null,
      overall: null,
    },
  },
  {
    type: "narration",
    data: "There's no clear human answer on this one, so I'm checking what's known in mice — but first, does this specific change look damaging?",
  },
  {
    type: "fragment",
    data: {
      id: "myvariant-clinvar-1",
      source: "myvariant",
      step: 2,
      queryTime: "2026-06-13T17:00:04.000Z",
      found: true,
      summary: "ClinVar: Uncertain significance (VUS), last reviewed 2023.",
      raw: {
        clinvar: {
          clinical_significance: "Uncertain significance",
          review_status: "criteria provided, single submitter",
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
      queryTime: "2026-06-13T17:00:05.000Z",
      found: true,
      summary: "gnomAD allele frequency 0.0000041 — very rare.",
      raw: { gnomad: { af: 0.0000041, ac: 1, an: 242000 } },
      relevance: "medium",
    },
  },
  {
    type: "fragment",
    data: {
      id: "myvariant-alphamissense-1",
      source: "myvariant",
      step: 2,
      queryTime: "2026-06-13T17:00:06.000Z",
      found: true,
      summary: "AlphaMissense: likely pathogenic (0.90).",
      raw: { alphamissense: { score: 0.9012, class: "likely_pathogenic" } },
      relevance: "high",
    },
  },
  {
    type: "fragment",
    data: {
      id: "conservation-1",
      source: "ensembl_conservation",
      step: 2,
      queryTime: "2026-06-13T17:00:07.000Z",
      found: true,
      summary: "Residue is highly conserved across vertebrates (GERP 5.6).",
      raw: { gerp: 5.6, phylop: 7.9 },
      relevance: "high",
    },
  },
  {
    type: "pipeline_update",
    data: {
      genePrior: {
        value: 0.85,
        label: "high",
        reason: "KCNQ1 is strongly loss-of-function intolerant.",
      },
      variantEffect: {
        value: 0.82,
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
    data: "This change looks damaging, and it behaves like a loss-of-function — which means the mouse knockout is a fair comparison.",
  },
  {
    type: "pipeline_update",
    data: {
      genePrior: {
        value: 0.85,
        label: "high",
        reason: "KCNQ1 is strongly loss-of-function intolerant.",
      },
      variantEffect: {
        value: 0.82,
        label: "high",
        reason: "AlphaMissense likely-pathogenic at a conserved residue.",
      },
      mechanismGate: {
        value: 0.95,
        reason: "Predicted loss-of-function; matches a knockout.",
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
      queryTime: "2026-06-13T17:00:10.000Z",
      found: true,
      summary: "Clean 1:1 mouse ortholog Kcnq1 (DIOPT 15/15, 92% identity).",
      raw: { ortholog: "Kcnq1", diopt_score: 15, max_score: 15, percent_identity: 92 },
      relevance: "high",
    },
  },
  {
    type: "fragment",
    data: {
      id: "impc-1",
      source: "impc",
      step: 4,
      queryTime: "2026-06-13T17:00:11.000Z",
      found: true,
      summary: "Mouse Kcnq1 knockout shows a cardiac-conduction phenotype (non-lethal).",
      raw: {
        allele: "Kcnq1<tm1>",
        phenotypes: ["abnormal ECG", "prolonged QT interval"],
        viability: "viable",
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
      queryTime: "2026-06-13T17:00:12.000Z",
      found: true,
      summary: "High MP↔HPO phenotype similarity to long-QT syndrome (phenodigm 78).",
      raw: { phenodigm_score: 78.4, top_hpo: ["HP:0001657 Prolonged QT interval"] },
      relevance: "high",
    },
  },
  {
    type: "pipeline_update",
    data: {
      genePrior: {
        value: 0.85,
        label: "high",
        reason: "KCNQ1 is strongly loss-of-function intolerant.",
      },
      variantEffect: {
        value: 0.82,
        label: "high",
        reason: "AlphaMissense likely-pathogenic at a conserved residue.",
      },
      mechanismGate: {
        value: 0.95,
        reason: "Predicted loss-of-function; matches a knockout.",
      },
      crossSpecies: {
        value: 0.88,
        label: "high",
        reason: "Clean ortholog; mouse cardiac phenotype maps to long-QT.",
      },
      overall: null,
    },
  },
  {
    type: "narration",
    data: "The mouse version of this gene, when switched off, causes a heart-rhythm problem that lines up with what this test was looking for.",
  },
  {
    type: "pipeline_update",
    data: {
      genePrior: {
        value: 0.85,
        label: "high",
        reason: "KCNQ1 is strongly loss-of-function intolerant.",
      },
      variantEffect: {
        value: 0.82,
        label: "high",
        reason: "AlphaMissense likely-pathogenic at a conserved residue.",
      },
      mechanismGate: {
        value: 0.95,
        reason: "Predicted loss-of-function; matches a knockout.",
      },
      crossSpecies: {
        value: 0.88,
        label: "high",
        reason: "Clean ortholog; mouse cardiac phenotype maps to long-QT.",
      },
      overall: { label: "high", reason: "All layers agree; mechanism matches." },
    },
  },
  {
    type: "complete",
    briefUrl: "/brief/kcnq1-demo",
  },
];
