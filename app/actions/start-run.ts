// /app/actions/start-run.ts
// Server Action: emit the pipeline request event. This is what the intake form calls.
// Emitting works even before Person A's function exists — Inngest just queues the event.
"use server";
import { inngest } from "@/inngest/client";
import { INNGEST_EVENT } from "@/lib/realtime-constants";

export async function startRun(input: {
  runId: string;
  variant: string;
  clinicalContext: string;
}) {
  await inngest.send({ name: INNGEST_EVENT, data: input });
}
