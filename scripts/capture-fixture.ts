// Runs the REAL pipeline orchestrator locally (no Inngest) for the demo
// variants: live genomics APIs + live Grok. Prints the ordered RealtimeEvent
// stream and writes two handoff artifacts per variant into fixtures/:
//   • <id>-run.json    — the ordered RealtimeEvent[] (Person B replays this)
//   • <id>-output.json — the final { evidenceCard, doctorBrief }
//
// Usage:  npx tsx scripts/capture-fixture.ts          (all three)
//         npx tsx scripts/capture-fixture.ts ldlr     (one)

try {
  process.loadEnvFile(".env.local");
} catch {
  /* Next loads env automatically; standalone needs this. */
}

import { mkdirSync, writeFileSync } from "node:fs";
import { runEvidencePipeline } from "@/lib/pipeline/run-evidence-pipeline";
import { DEMO_VARIANTS } from "@/lib/demo-variants";
import type { RealtimeEvent } from "@/lib/types";

function printEvent(e: RealtimeEvent) {
  if (e.type === "fragment") {
    const rel = e.data.relevance && e.data.relevance !== "unscored" ? ` [rel=${e.data.relevance}]` : "";
    console.log(`  ▸ frag(step${e.data.step}/${e.data.source})${rel}: ${e.data.summary}`);
  } else if (e.type === "narration") {
    console.log(`  🗣  ${e.data}`);
  } else if (e.type === "pipeline_update") {
    const p = e.data;
    const seg = (l: { value: number; label?: string } | null) => (l ? `${(l.value).toFixed(2)}${l.label ? `/${l.label}` : ""}` : "·");
    console.log(`  📊 gene=${seg(p.genePrior)} effect=${seg(p.variantEffect)} gate=${seg(p.mechanismGate)} cross=${seg(p.crossSpecies)} overall=${p.overall?.label ?? "·"}`);
  } else if (e.type === "complete") {
    console.log(`  ✅ complete → ${e.briefUrl}`);
  }
}

async function captureOne(d: (typeof DEMO_VARIANTS)[number]) {
  console.log("\n" + "═".repeat(80));
  console.log(`▶ ${d.label}  (${d.variant} / ${d.clinicalContext})`);
  console.log("─".repeat(80));

  const events: RealtimeEvent[] = [];
  const runId = `${d.id}-fixture`;
  const t0 = Date.now();

  const out = await runEvidencePipeline(
    { runId, variant: d.variant, clinicalContext: d.clinicalContext },
    {
      runStep: (_name, fn) => fn(),
      publish: async (_key, event) => {
        events.push(event);
        printEvent(event);
      },
      registerWatcher: false,
    },
  );

  mkdirSync("fixtures", { recursive: true });
  writeFileSync(`fixtures/${d.id}-run.json`, JSON.stringify(events, null, 2));
  writeFileSync(`fixtures/${d.id}-output.json`, JSON.stringify(out, null, 2));

  console.log("─".repeat(80));
  console.log(`  OVERALL: ${out.doctorBrief.overall.toUpperCase()}  |  ${events.length} events  |  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`  ACMG: ${out.doctorBrief.acmgRows.map((r) => `${r.code}(${r.direction})`).join(", ") || "none"}`);
  console.log(`  wrote fixtures/${d.id}-run.json + fixtures/${d.id}-output.json`);
}

async function main() {
  const only = process.argv[2];
  const list = only ? DEMO_VARIANTS.filter((d) => d.id === only) : DEMO_VARIANTS;
  if (list.length === 0) {
    console.error(`No demo variant matching "${only}". Options: ${DEMO_VARIANTS.map((d) => d.id).join(", ")}`);
    process.exit(1);
  }
  for (const d of list) await captureOne(d);
  console.log("\n" + "═".repeat(80) + "\ndone.");
}

main().catch((e) => {
  console.error("\nPIPELINE ERROR:", e);
  process.exit(1);
});
