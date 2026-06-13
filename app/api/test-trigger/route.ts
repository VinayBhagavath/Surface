// Temporary test trigger — emits `vus.evidence.requested`.
//   GET  /api/test-trigger?demo=ldlr|cacna1c|kcnq1
//   GET  /api/test-trigger?variant=rs879254403&context=hypercholesterolemia
//   POST /api/test-trigger  { variant, clinicalContext, runId? }
//
// Person B's real intake Server Action emits the same event; this route is just
// for backend testing without the UI.

import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { DEMO_VARIANTS, demoById } from "@/lib/demo-variants";

export const dynamic = "force-dynamic";

function respond(runId: string, variant: string, clinicalContext: string) {
  return NextResponse.json({
    ok: true,
    runId,
    variant,
    clinicalContext,
    channel: `vus-run-${runId}`,
    realtimeToken: `/api/realtime-token?runId=${runId}`,
    brief: `/brief/${runId}`,
  });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  // Force a Watcher re-check across the watchlist: /api/test-trigger?watch=1
  if (sp.get("watch")) {
    await inngest.send({ name: "vus.watch.recheck", data: { runId: sp.get("runId") ?? "all" } });
    return NextResponse.json({ ok: true, triggered: "vus.watch.recheck" });
  }

  const demo = sp.get("demo");
  let variant: string;
  let clinicalContext: string;
  if (demo) {
    const d = demoById(demo);
    if (!d) return NextResponse.json({ error: `unknown demo "${demo}"`, options: DEMO_VARIANTS.map((x) => x.id) }, { status: 400 });
    variant = d.variant;
    clinicalContext = d.clinicalContext;
  } else {
    variant = sp.get("variant") ?? DEMO_VARIANTS[0].variant;
    clinicalContext = sp.get("context") ?? DEMO_VARIANTS[0].clinicalContext;
  }
  const runId = sp.get("runId") ?? `run-${Date.now()}`;
  await inngest.send({ name: "vus.evidence.requested", data: { runId, variant, clinicalContext } });
  return respond(runId, variant, clinicalContext);
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    variant?: string;
    clinicalContext?: string;
    runId?: string;
  };
  const variant = body.variant ?? DEMO_VARIANTS[0].variant;
  const clinicalContext = body.clinicalContext ?? DEMO_VARIANTS[0].clinicalContext;
  const runId = body.runId ?? `run-${Date.now()}`;
  await inngest.send({ name: "vus.evidence.requested", data: { runId, variant, clinicalContext } });
  return respond(runId, variant, clinicalContext);
}
