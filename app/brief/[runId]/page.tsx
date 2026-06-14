// /brief/[runId] - printable Doctor Brief. Fixture demos render captured real
// outputs; live runs render only the real RunOutput saved by the pipeline.
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import type { RunOutput } from "@/lib/types";
import { getOutput } from "@/lib/store";
import { BriefDocument } from "@/components/BriefDocument";
import { BriefActions } from "@/components/BriefActions";

export const dynamic = "force-dynamic";

export default async function BriefPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;

  const output: RunOutput | null = await getOutput(runId);

  return (
    <main className="surface-grid min-h-screen px-4 py-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between print:hidden">
          {/* The session is a one-shot LIVE stream — it can't be re-entered after
              it finishes (the Realtime run is over), so back always returns to
              the upload page to start a fresh analysis rather than a stuck stream. */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Start a new analysis
          </Link>
          {output && <BriefActions />}
        </div>
        {output ? (
          <BriefDocument output={output} />
        ) : (
          <section className="rounded-2xl border bg-card p-8 text-center shadow-sm">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              live run still resolving
            </p>
            <h1 className="mt-2 font-serif text-3xl font-semibold text-foreground">
              Doctor Brief is not ready yet
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              The evidence pipeline has not written a completed output for this run. The
              brief becomes available once the live run finishes — start a new analysis
              from the upload page if this run didn&rsquo;t complete.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
