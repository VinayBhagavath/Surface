// The durable evidence pipeline function. It is a THIN adapter: it maps Inngest
// primitives onto the shared orchestrator (lib/pipeline/run-evidence-pipeline).
//   • runStep  -> step.run        (durable, retried, memoized)
//   • publish  -> Realtime publish, itself wrapped in a step so a retry/replay
//                 doesn't re-emit duplicate events.

import { inngest } from "@/inngest/client";
import { vusRunChannel } from "@/inngest/channels";
import { runEvidencePipeline, type StepRunner } from "@/lib/pipeline/run-evidence-pipeline";

export const evidencePipeline = inngest.createFunction(
  { id: "evidence-pipeline", name: "VUS Evidence Pipeline", retries: 3, concurrency: 5 },
  { event: "vus.evidence.requested" },
  async ({ event, step, publish }) => {
    const { runId, variant, clinicalContext } = event.data;

    const runStep = ((name: string, fn: () => Promise<unknown>) =>
      step.run(name, fn)) as StepRunner;

    const out = await runEvidencePipeline(
      { runId, variant, clinicalContext },
      {
        runStep,
        publish: async (key, ev) => {
          await step.run(`publish:${key}`, async () => {
            await publish(vusRunChannel(runId).events(ev));
            return { published: key };
          });
        },
      },
    );

    return { runId, gene: out.doctorBrief.geneSymbol, overall: out.doctorBrief.overall };
  },
);
