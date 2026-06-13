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

  return <SessionView runId={runId} demo={demo} />;
}
