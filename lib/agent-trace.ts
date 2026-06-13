// High-level, plain-language agent trace.
//
// The full pipeline emits ~20 fine-grained events. Patients don't need every
// API call — they need to see the agent is doing real, understandable work. So
// we collapse the pipeline's steps (0-6) into a handful of friendly stages and
// light them up as the real fragments/pipeline updates arrive.

import type { ConfidencePipelineState, EvidenceFragment } from "@/lib/types";

export type StageStatus = "pending" | "active" | "done";

export type TraceStage = {
  id: string;
  /** Shown when pending / done. */
  label: string;
  /** Shown (with a spinner) while this stage is the active one. */
  activeLabel: string;
};

export const TRACE_STAGES: TraceStage[] = [
  { id: "sequence", label: "Read the DNA change", activeLabel: "Reading the DNA change" },
  { id: "gene", label: "Checked how essential the gene is", activeLabel: "Checking how essential the gene is" },
  { id: "effect", label: "Studied the change's likely effect", activeLabel: "Studying the change's likely effect" },
  { id: "gate", label: "Decided whether animal studies apply", activeLabel: "Deciding whether animal studies apply" },
  { id: "mouse", label: "Read mouse disease research", activeLabel: "Reading mouse disease research" },
  { id: "papers", label: "Read published research papers", activeLabel: "Reading published research papers" },
  { id: "summary", label: "Wrote your summary", activeLabel: "Writing your summary" },
];

/** Map live run state -> a status for each friendly stage. */
export function stageStatuses(input: {
  fragments: EvidenceFragment[];
  pipeline: ConfidencePipelineState;
  complete: boolean;
}): StageStatus[] {
  const { fragments, pipeline, complete } = input;
  const reached = fragments.reduce((max, f) => Math.max(max, f.step), -1);
  const gateSeen = pipeline.mechanismGate != null;

  // done predicate per stage, in order
  const done = [
    reached >= 0, // sequence (step 0 VEP)
    reached >= 1, // gene constraint (step 1)
    reached >= 2, // variant effect (step 2)
    gateSeen, // mechanism gate (step 3)
    reached >= 4, // cross-species / mouse (step 4)
    reached >= 5 || complete, // literature pass (alongside step 5/6 synthesis)
    complete, // summary
  ];

  if (complete) return done.map(() => "done");

  const statuses: StageStatus[] = [];
  let activeAssigned = false;
  for (let i = 0; i < TRACE_STAGES.length; i++) {
    if (done[i]) {
      statuses.push("done");
    } else if (!activeAssigned) {
      statuses.push("active");
      activeAssigned = true;
    } else {
      statuses.push("pending");
    }
  }
  return statuses;
}
