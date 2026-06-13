// Inngest client. Realtime middleware is what makes `publish` available inside
// functions (and what the frontend subscribes to). Event schemas are typed so
// `inngest.send` and the function triggers are checked.

import { EventSchemas, Inngest } from "inngest";
import { realtimeMiddleware } from "@inngest/realtime/middleware";
import type { EvidenceRequestedData } from "@/lib/types";

type Events = {
  "vus.evidence.requested": { data: EvidenceRequestedData };
  "vus.watch.recheck": { data: { runId: string } };
};

export const inngest = new Inngest({
  id: "vus-resolver",
  schemas: new EventSchemas().fromRecord<Events>(),
  middleware: [realtimeMiddleware()],
});
