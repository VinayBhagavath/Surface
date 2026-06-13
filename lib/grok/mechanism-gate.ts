// Grok call #2 (Step 3) — the Mechanism-Compatibility Gate.
// The load-bearing reasoning call: how much can a mouse loss-of-function
// KNOCKOUT phenotype tell us about THIS human variant? Output is a gate in
// [0,1] WITH stated reasoning, computed BEFORE the cross-species pass runs.

import { callGrokJSON } from "@/lib/grok/client";
import { MechanismGateSchema, type MechanismGate } from "@/lib/grok/schemas";

export async function mechanismGate(input: {
  geneSymbol: string;
  consequenceClass: string;
  predictorDirection: string; // deleterious | benign | uncertain
  conservationSupport: string; // supports | neutral | undercuts
  geneConstraint: { loeuf: number | null; pli: number | null; misZ: number | null };
  geneMechanism: { mechanism: string; inheritanceMode: string; notes: string } | null;
}): Promise<MechanismGate> {
  const system = `You compute a MECHANISM-COMPATIBILITY GATE in [0,1]: the degree to which a mouse loss-of-function KNOCKOUT phenotype is informative for THIS human variant. The gate multiplies the cross-species evidence later, so be principled.

Rules:
- Gene mechanism documented as loss-of-function (LoF), and the variant is LoF or a damaging missense -> a knockout models the disease well -> gate near 1.0.
- Gene mechanism documented as GAIN-of-function (GoF) / dominant-active -> a loss-of-function knockout CANNOT model the disease, no matter how dramatic the knockout phenotype (even embryonic lethality) -> gate near 0.1. Say this explicitly in the reason.
- Mechanism "both" or unknown -> be cautious -> gate ~0.4-0.6, and state the uncertainty.
- A predicted-LoF variant in a LoF-intolerant gene (low LOEUF / high pLI) -> gate 1.0.
- If the gene is not in the mechanism table (geneMechanism is null), you do not know the mechanism: keep the gate moderate (~0.5) and flag that mechanism is unconfirmed.

Set mouseInformative = (gate >= 0.5). Give a single clinician-acceptable sentence in reason.

Output JSON with EXACTLY these keys:
{
  "gate": <number between 0 and 1>,
  "mouseInformative": <boolean>,
  "reason": "<one clinician-acceptable sentence>"
}`;
  return callGrokJSON(system, JSON.stringify(input, null, 2), MechanismGateSchema, {
    maxTokens: 500,
    label: "gate",
    // The load-bearing multi-factor judgment — give it real reasoning.
    reasoningEffort: "medium",
  });
}
