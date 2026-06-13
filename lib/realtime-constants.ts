// /lib/realtime-constants.ts
// SHARED — FROZEN. Keep identical to Person A. Merge-critical.
export const INNGEST_EVENT = "vus.evidence.requested" as const;
export const runChannel = (runId: string) => `vus-run-${runId}`;
