// /session/[runId] - server shell. Awaits params/searchParams (Next 16) and hands
// the live run off to the interactive client view. Every run is live: it streams
// from the Inngest Realtime channel for this runId and reads the run's real output.
import { SessionView } from "@/components/SessionView";

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { runId } = await params;
  const sp = await searchParams;
  const variant = typeof sp.variant === "string" ? sp.variant : undefined;
  const clinicalContext = typeof sp.context === "string" ? sp.context : undefined;
  const gene = typeof sp.gene === "string" ? sp.gene : undefined;

  return (
    <SessionView runId={runId} variant={variant} clinicalContext={clinicalContext} gene={gene} />
  );
}
