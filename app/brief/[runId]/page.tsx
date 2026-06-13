// /brief/[runId] — the printable Doctor Brief. Server shell: awaits params/searchParams,
// resolves the demo, and renders Person A's real RunOutput (*-output.json) for now. At Step 9
// this swaps to fetching GET /api/brief/:runId (RunOutput), no document changes.
import Link from "next/link";
import { headers } from "next/headers";
import { ArrowLeft } from "lucide-react";

import type { RunOutput } from "@/lib/types";
import { DEMO_OUTPUTS, DEFAULT_DEMO, isDemoId } from "@/fixtures/runs";
import { BriefDocument } from "@/components/BriefDocument";
import { BriefActions } from "@/components/BriefActions";

export default async function BriefPage({
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

  // Default: Person A's real captured fixture. With ?live, read the live RunOutput from
  // Person A's GET /api/brief/:runId (Step 9). That route lives on `backend`, so on `yesh`
  // this falls back to the fixture — verified at the joint test.
  let output: RunOutput = DEMO_OUTPUTS[demo];
  if (live) {
    try {
      const h = await headers();
      const host = h.get("host");
      const proto = h.get("x-forwarded-proto") ?? "http";
      if (host) {
        const res = await fetch(
          `${proto}://${host}/api/brief/${encodeURIComponent(runId)}`,
          { cache: "no-store" },
        );
        if (res.ok) output = (await res.json()) as RunOutput;
      }
    } catch {
      /* fall back to the fixture */
    }
  }

  return (
    <main className="surface-grid min-h-screen px-4 py-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <Link
            href={`/session/${runId}?demo=${demo}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back to session
          </Link>
          <BriefActions />
        </div>
        <BriefDocument output={output} />
      </div>
    </main>
  );
}
