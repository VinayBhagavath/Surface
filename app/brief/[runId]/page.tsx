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

  const output: RunOutput | null = await getOutput(runId);
  const backParams = new URLSearchParams({ live: "1" });
  if (variant) backParams.set("variant", variant);
  if (clinicalContext) backParams.set("context", clinicalContext);
  if (gene) backParams.set("gene", gene);

  return (
    <main className="surface-grid min-h-screen px-4 py-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <Link
            href={`/session/${runId}?${backParams.toString()}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back to session
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
              The evidence pipeline has not written a completed output for this run. Return
              to the session stream and open the brief after the completion event appears.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
