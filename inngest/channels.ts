// The per-run Realtime channel (the seam with Person B's useEvidenceRun hook).
// Channel name: `vus-run-${runId}`. Single topic "events" carrying RealtimeEvent.

import { channel, topic } from "@inngest/realtime";
import type { RealtimeEvent } from "@/lib/types";

export const vusRunChannel = channel((runId: string) => `vus-run-${runId}`).addTopic(
  topic("events").type<RealtimeEvent>(),
);
