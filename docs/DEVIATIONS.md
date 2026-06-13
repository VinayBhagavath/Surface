# Deviations from the spec (and why)

Honest record of where the implementation differs from the original 12-step
implementation prompt and/or the v2 architecture, with the reasoning. Most are
forced by **real data** (the no-mocks constraint) — which is the point.

## Contract: built to v2, not the 12-step prompt's v1 types

The pasted 12-step prompt used a *v1* contract (5 sources, `ConfidenceBreakdown`,
`RealtimeEvent` with `confidence_update`/`complete{evidenceCard,doctorBrief}`).
The architecture doc ("**This supersedes the original architecture**") and BOTH
Person A/B build plans use a *richer v2* contract (7 sources, `EvidenceFragment`
with `id`+`step`, `ConfidencePipelineState` with the mechanism gate,
`RealtimeEvent` with `pipeline_update`/`complete{briefUrl}`). Since Person B
builds against the v2 contract, **the merge seam must be v2** — so `lib/types.ts`
is v2. The engineering discipline from the 12-step prompt (standalone connector
tests, a pure unit-tested confidence function, fixtures, the Watcher) is all
preserved, just mapped onto the v2 pipeline (Steps 0–6).

## Demo gene selection: driven by real IMPC data

The architecture proposed **KCNQ1** as the "everything agrees" lead with a
"cardiac-conduction IMPC phenotype." **Reality: IMPC has zero significant Kcnq1
knockout calls.** Faking one would violate the no-mocks rule. So:

- **LDLR** (p.Phe32Ser) became the HIGH lead — real, rich IMPC (Ldlr KO →
  ↑cholesterol p=1.8e‑63), clean ortholog, LoF mechanism, conserved, predictors
  agree. A textbook everything-agrees case, entirely real.
- **CACNA1C** (p.Arg508Trp) is the gate-closing case — GoF (Timothy syndrome) with
  a dramatic *lethal* knockout that the mechanism gate correctly suppresses.
- **KCNQ1** stayed, repurposed as the honest LOW case (predictor disagreement +
  `found:false` IMPC). The engine is gene-agnostic; only the demo set changed.

## Gene-prior is honestly low for some leads

gnomAD says **LDLR and KCNQ1 are LoF-tolerant** (pLI≈0) — heterozygous LoF is
common. The gene-prior layer reports this truthfully and stays low; the overall
rating is carried by variant-effect + cross-species. We did NOT inflate constraint
to match the architecture's "LoF-intolerant" assumption.

## Connector-level reality

- **Conservation** (`ensembl-conservation`): the Ensembl overlap feature is
  `constrained` (GERP constrained elements), not `constrained_element`. We report
  element-level GERP AND fold in dbNSFP per-residue GERP++/phyloP from MyVariant —
  both real, documented as element- + residue-level.
- **DIOPT** (`ensembl-diopt`): the public DIOPT API was unreliable/unparseable in
  this environment, so it's **best-effort enrichment** — orthology comes from
  Ensembl homology (which yields the mouse symbol IMPC needs) and the summary says
  "DIOPT rank unavailable" when DIOPT doesn't answer. Graceful degradation, not a
  failure.
- **Monarch** (`monarch`): v3 `/semsim/compare` with the
  `ancestor_information_content` metric returns an IC score (≈0–16), not a 0–1
  phenodigm. The confidence model buckets it. Grok reads the actual MP/HPO term
  text regardless (the IC number alone is never trusted).
- **MyVariant** fields are frequently arrays (one per transcript) and are
  normalized (max for pathogenicity scores); CADD is top-level `cadd.phred`.

## Pipeline shape

- **Step 4 is partly sequential** (ortholog → IMPC → Monarch) because of genuine
  data dependencies (IMPC needs the mouse symbol; Monarch needs the MP terms). It
  is still fan-out *relative to* the human-side steps and each call is a durable
  step.
- **Relevance filtering folded into Step 5.** The v1 prompt had a separate "IMPC
  relevance" Grok call; in v2 the cross-species sanity-check call assigns
  `relevance` to each IMPC fragment, keeping the count at **four reasoning calls
  per run** (auditability) while still re-publishing fragments as updates.
- **The deterministic confidence model owns the `overall` label**; Grok synthesis
  explains it and writes the ACMG mapping + prose, but does not override it.

## Infra

- **Inngest pinned to v3.** `@inngest/realtime@0.4.6` peer-depends on
  `inngest@^3.42.3`; v4 breaks the middleware/`createFunction` types. (npm's
  `latest` installed v4 first; we downgraded.)
- **Watcher has a cron AND an event trigger.** The Inngest dev server didn't
  reliably auto-fire the `*/2` cron within a short observation window, so the
  `vus.watch.recheck` event is the verified/demo path (and is independently
  useful). On Inngest Cloud the cron fires on schedule. Cadence is config.
- **Grok model**: `grok-4.3` (what the `grok-4` alias resolves to on this key);
  the key also has `grok-4.20-*` reasoning variants available.
