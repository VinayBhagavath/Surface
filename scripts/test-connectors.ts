// Standalone live test of all seven connectors for the three demo variants.
// Run: npm run connectors            (or: npx tsx scripts/test-connectors.ts)
//
// This mirrors the connector portion of the pipeline data flow but calls the
// connectors directly (no Inngest), so you can validate API response shapes
// fast. Each connector is wrapped so one failure doesn't abort the report.

import {
  ensemblVep,
  gnomadConstraint,
  myvariant,
  ensemblConservation,
  ensemblDiopt,
  impc,
  monarch,
} from "@/lib/connectors";
import { getGeneMechanism, zygosityForInheritance, hpoTermsForContext } from "@/lib/reference";
import { DEMO_VARIANTS } from "@/lib/demo-variants";

const line = (s = "") => console.log(s);
async function step<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    const r = await fn();
    return r;
  } catch (e) {
    line(`   ✗ ${label} THREW: ${(e as Error).message}`);
    return null;
  }
}

async function runVariant(d: (typeof DEMO_VARIANTS)[number]) {
  line("\n" + "═".repeat(78));
  line(`▶ ${d.label}`);
  line(`  input: ${d.variant} | context: ${d.clinicalContext}`);
  line(`  expect: ${d.expectation}`);
  line("─".repeat(78));

  // Step 0 — VEP
  const vep = await step("VEP", () => ensemblVep({ variant: d.variant }));
  if (!vep) return;
  const r = vep.resolved;
  line(`  [0] ${vep.fragment.summary}`);
  const gene = r.geneSymbol;
  if (!gene) {
    line("   ✗ no gene symbol resolved — stopping this variant");
    return;
  }

  // Step 1 — gnomAD constraint  +  Step 2 — MyVariant + conservation (parallel-ish)
  const constraint = await step("gnomadConstraint", () => gnomadConstraint({ geneSymbol: gene }));
  if (constraint) line(`  [1] ${constraint.summary}`);

  const mv = await step("myvariant", () => myvariant({ variant: d.variant, rsId: r.rsId }));
  if (mv) {
    for (const f of mv.fragments) line(`  [2] ${f.summary}`);
    line(`      → clinvarStatus=${mv.parsed.clinvarStatus} alreadyClassified=${mv.parsed.alreadyClassified} common=${mv.parsed.gnomadCommon}`);
  }

  const cons = await step("conservation", () =>
    ensemblConservation({
      chrom: r.chrom,
      pos: r.pos,
      geneSymbol: gene,
      perResidueGerp: mv?.parsed.perResidue.gerp ?? null,
      perResiduePhyloP: mv?.parsed.perResidue.phyloP ?? null,
    }),
  );
  if (cons) line(`  [2] ${cons.summary}`);

  // Step 4 — ortholog
  const orth = await step("ensemblDiopt", () => ensemblDiopt({ geneSymbol: gene }));
  if (orth) line(`  [4] ${orth.fragment.summary}`);
  const mouseSymbol = orth?.ortholog.mouseGeneSymbol ?? null;

  // Step 4 — IMPC (zygosity-matched)
  const mech = getGeneMechanism(gene);
  const zyg = zygosityForInheritance(mech?.inheritanceMode ?? null);
  line(`      → mechanism table: ${mech ? `${mech.mechanism}/${mech.inheritanceMode} (zyg=${zyg})` : "NOT IN TABLE"}`);
  let mpTermIds: string[] = [];
  if (mouseSymbol) {
    const imp = await step("impc", () => impc({ mouseGeneSymbol: mouseSymbol, zygosity: zyg }));
    if (imp) {
      for (const f of imp.fragments) line(`  [4] ${f.summary}`);
      mpTermIds = imp.result.mpTermIds;
      line(`      → phenotypeCount=${imp.result.phenotypeCount} lethal=${imp.result.lethal}`);
    }
  } else {
    line("   ✗ no mouse symbol — skipping IMPC/Monarch");
  }

  // Step 4 — Monarch
  const hpo = hpoTermsForContext(d.clinicalContext);
  line(`      → HPO terms for "${d.clinicalContext}": ${hpo.join(", ") || "(none)"}`);
  if (mpTermIds.length && hpo.length) {
    const mon = await step("monarch", () => monarch({ mpTermIds, hpoTermIds: hpo }));
    if (mon) line(`  [4] ${mon.fragment.summary}`);
  } else {
    line(`  [4] Monarch: skipped (mp=${mpTermIds.length}, hpo=${hpo.length})`);
  }
}

async function main() {
  const only = process.argv[2];
  const list = only ? DEMO_VARIANTS.filter((d) => d.id === only) : DEMO_VARIANTS;
  for (const d of list) await runVariant(d);
  line("\n" + "═".repeat(78));
  line("done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
