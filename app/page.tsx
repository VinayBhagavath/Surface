"use client";

// Intake — radically simplified. One thing to do: upload a sequencing file.
// We find the variant of uncertain significance in it, then take you straight
// to the live investigation (DNA view → agent trace → plain-language summary).

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dna, UploadCloud, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";

import { startRun } from "@/app/actions/start-run";
import { parseVariantsFromText, resolveVariant } from "@/lib/variant-intake";
import { cn } from "@/lib/utils";

const SAMPLE_VCF = "/samples/sample-ldlr.vcf";

export default function IntakePage() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const go = React.useCallback(
    (resolved: { demo: string; variant: string; clinicalContext: string }) => {
      const runId = crypto.randomUUID();
      // Fire the real pipeline best-effort (exercises Inngest + Watcher when the
      // dev server is up); never block or fail the experience on it.
      startRun({ runId, variant: resolved.variant, clinicalContext: resolved.clinicalContext }).catch(
        () => {},
      );
      const q = new URLSearchParams({
        demo: resolved.demo,
        variant: resolved.variant,
        context: resolved.clinicalContext,
      });
      router.push(`/session/${runId}?${q.toString()}`);
    },
    [router],
  );

  const handleFile = React.useCallback(
    async (file: File) => {
      setBusy(true);
      try {
        const text = await file.text();
        const variants = parseVariantsFromText(text);
        const resolved = resolveVariant(variants);
        if (resolved.matched) {
          toast.success(`Found ${resolved.variant} — starting the investigation.`);
        } else {
          toast.message("No flagged variant recognized — running a sample case so you can see the flow.");
        }
        go(resolved);
      } catch {
        setBusy(false);
        toast.error("Couldn't read that file. Try a .vcf or plain-text file.");
      }
    },
    [go],
  );

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  async function useSampleFile() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(SAMPLE_VCF);
      const text = await res.text();
      const file = new File([text], "sample.vcf", { type: "text/plain" });
      await handleFile(file);
    } catch {
      setBusy(false);
      toast.error("Couldn't load the sample file.");
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg space-y-8">
        <header className="space-y-3 text-center">
          <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            <Dna className="size-3.5" /> VUS Resolver
          </span>
          <h1 className="text-balance font-serif text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-[2.75rem]">
            Upload your sequencing file.
          </h1>
          <p className="text-pretty mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
            We&rsquo;ll find the uncertain change in your DNA, research it across
            species, and explain what it means in plain language.
          </p>
        </header>

        {/* the one action: upload */}
        <button
          type="button"
          onClick={() => !busy && fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          disabled={busy}
          className={cn(
            "group flex w-full flex-col items-center gap-4 rounded-2xl border-2 border-dashed bg-card px-6 py-14 text-center transition-colors",
            dragging ? "border-primary bg-accent" : "border-border hover:border-foreground/30 hover:bg-accent/40",
            busy && "pointer-events-none opacity-70",
          )}
        >
          <span
            className={cn(
              "flex size-14 items-center justify-center rounded-full transition-colors",
              dragging ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground group-hover:text-foreground",
            )}
          >
            {busy ? <Loader2 className="size-7 animate-spin" /> : <UploadCloud className="size-7" />}
          </span>
          <span className="space-y-1">
            <span className="block text-base font-medium text-foreground">
              {busy ? "Reading your file…" : "Drop a VCF file here, or click to browse"}
            </span>
            <span className="block text-xs text-muted-foreground">
              Your file stays in your browser. We only read the variant.
            </span>
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".vcf,.txt,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </button>

        {/* one unobtrusive way to try it without a file on hand */}
        <div className="text-center">
          <button
            type="button"
            disabled={busy}
            onClick={useSampleFile}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline disabled:opacity-60"
          >
            <FileText className="size-3.5" />
            Don&rsquo;t have your file handy? Use a sample file
          </button>
        </div>
      </div>
    </main>
  );
}
