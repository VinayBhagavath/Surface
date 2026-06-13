// Issues a scoped Inngest Realtime subscription token for one run's channel.
// Person B's `useEvidenceRun(runId)` hook fetches this and passes it to
// `useInngestSubscription` from "@inngest/realtime/hooks".

import { NextRequest, NextResponse } from "next/server";
import { getSubscriptionToken } from "@inngest/realtime";
import { inngest } from "@/inngest/client";
import { vusRunChannel } from "@/inngest/channels";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get("runId");
  if (!runId) return NextResponse.json({ error: "runId required" }, { status: 400 });

  const token = await getSubscriptionToken(inngest, {
    channel: vusRunChannel(runId),
    topics: ["events"],
  });

  return NextResponse.json(token);
}
