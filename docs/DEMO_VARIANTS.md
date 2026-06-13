# Demo Variants

Three **real** ClinVar VUS, chosen empirically so their LIVE data exercises every
path of the pipeline. Defined in [`lib/demo-variants.ts`](../lib/demo-variants.ts).
Outcomes below were produced by an actual `npm run capture` run (live APIs + Grok).

## 1. `ldlr` — everything agrees → **HIGH**

- **LDLR p.Phe32Ser** · `rs879254403` · context `hypercholesterolemia`
- Real data: AlphaMissense **0.99**, REVEL **0.97**, CADD **29.2** (all agree
  deleterious); GERP++ 5.5 / phyloP 5.74 (conserved); absent from gnomAD; clean
  1:1 mouse ortholog (Ldlr, 78%); **Ldlr KO → ↑circulating cholesterol p=1.8e‑63**;
  Monarch similarity **15.86** to "Hypercholesterolemia"; mechanism LoF/dominant.
- Pipeline: gene 0.30/low (LDLR is honestly LoF-*tolerant* — heterozygous LoF is
  common in the population), variant-effect 1.00/high, **gate 0.95** (open),
  cross-species 0.95/high → **overall HIGH**. ACMG: PM2, PP3, PS3_supporting.
- Teaching point: a low gene-prior does NOT sink the call — variant-effect +
  cross-species carry it. The layered model isn't just "is the gene constrained."

## 2. `cacna1c` — the mechanism gate CLOSES

- **CACNA1C p.Arg508Trp** · `rs776805699` · context `arrhythmia`
- Real data: AlphaMissense 0.97 / REVEL 0.83 / CADD 34 (agree); LOEUF 0.18 /
  pLI 1.00 (highly constrained); GERP element 60.1; **Cacna1c KO is embryonic
  lethal** (dramatic); Monarch similarity only 3.49 (poor match). Mechanism is
  **GoF** (Timothy syndrome = gain-of-function).
- Pipeline: gene 1.00/high, variant-effect 1.00/high, **gate 0.10**,
  cross-species raw ≈0.6 → **gated to 0.07/low** → overall HIGH (from the human
  side). Grok called the Monarch 3.49 an "ontology artifact" but credited the
  lethality as an essentiality signal; synthesis then **excluded the mouse data**
  because a LoF knockout can't model a GoF variant.
- Teaching point: **the single most differentiated demo moment.** Every other
  team treats a dramatic mouse phenotype as good news; this one explains, with the
  gate, why it isn't — while still being honest that the human evidence is strong.

## 3. `kcnq1` — uncertainty stays honest → **LOW**

- **KCNQ1 p.Ala194Val** · `rs2133727494` · context `long_qt`
- Real data: AlphaMissense **0.25 (benign)** vs REVEL **0.68** vs CADD **23.4** —
  genuine **predictor disagreement**; conserved residue (GERP element 47.9);
  **IMPC has NO significant Kcnq1 knockout phenotype** (`found:false`, real).
- Pipeline: gene 0.58/moderate, variant-effect 0.41/moderate (disagreement pulls
  toward uncertain), gate 0.75, cross-species 0.08/low (no mouse data) → **overall
  LOW**. ACMG even contains conflicting PP3 (pathogenic) + BP4 (benign).
- Teaching point: the tool refuses to manufacture confidence. `suggestedFollowUp`
  is `null`; the brief says what additional evidence would change the rating.

> The architecture originally proposed KCNQ1 as the "everything agrees" lead, but
> real IMPC has zero significant Kcnq1 calls — so per the no-mocks rule it became
> the honest LOW case, and LDLR (real, rich IMPC) became the HIGH lead. See
> [DEVIATIONS.md](DEVIATIONS.md).
