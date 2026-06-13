// Read path for a completed run's output. The pipeline writes
// { evidenceCard, doctorBrief } to the store on completion; Person B's
// /brief/[runId] and /session pages fetch it here by runId.

import { NextResponse } from "next/server";
import { getOutput } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { runId: string } }) {
  const out = await getOutput(params.runId);
  if (!out) {
    return NextResponse.json({ error: "not found", runId: params.runId }, { status: 404 });
  }
  return NextResponse.json(out);
}
