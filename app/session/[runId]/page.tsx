// /session/[runId] — server shell. Awaits params/searchParams (Next 16), resolves the
// fixture demo from ?demo=, and hands off to the interactive client view.
import { SessionView } from "@/components/SessionView";
import { DEFAULT_DEMO, isDemoId } from "@/fixtures/runs";

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { runId } = await params;
  const sp = await searchParams;
  const demoRaw = typeof sp.demo === "string" ? sp.demo : undefined;
  const demo = isDemoId(demoRaw) ? demoRaw : DEFAULT_DEMO;
  // ?live=1 flips to the live Inngest Realtime subscription (Step 9). Default = fixture replay.
  const live = sp.live === "1" || sp.live === "true";

  return <SessionView runId={runId} demo={demo} live={live} />;
}
