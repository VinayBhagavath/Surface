// /session/[runId] - server shell. Awaits params/searchParams (Next 16), resolves
// an optional demo display hint, and hands off to the interactive client view.
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
  const live = sp.live === "1" || sp.live === "true";
  const variant = typeof sp.variant === "string" ? sp.variant : undefined;
  const clinicalContext = typeof sp.context === "string" ? sp.context : undefined;

  return (
    <SessionView
      runId={runId}
      demo={demo}
      live={live}
      variant={variant}
      clinicalContext={clinicalContext}
    />
  );
}
