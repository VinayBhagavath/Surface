"use client";

// Intake — upload a sequencing file, see EVERY variant in it annotated to a real
// gene + consequence (live Ensembl VEP), pick the one to investigate, and launch
// the real evidence pipeline. The raw file is read in the browser; only the
// parsed variant coordinates are sent for the gene lookup, and nothing is stored.

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dna, UploadCloud, Loader2, FileText, ArrowRight, ShieldCheck, Check } from "lucide-react";
import { toast } from "sonner";

import { startRun } from "@/app/actions/start-run";
import { annotateVariants, type AnnotatedVariant } from "@/app/actions/annotate-vcf";
import { parseVcf } from "@/lib/vcf";
import { CLINICAL_CONTEXT_OPTIONS } from "@/lib/clinical-context-options";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

type Phase = "idle" | "reading" | "annotating" | "ready" | "error";

/** Read a VCF, transparently gunzipping .vcf.gz / .gz in the browser. */
async function readVariantText(file: File): Promise<string> {
  const isGz = /\.b?gz$/i.test(file.name);
  if (!isGz) return file.text();
  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser can't open .gz files — please decompress it first.");
  }
  return await new Response(file.stream().pipeThrough(new DecompressionStream("gzip"))).text();
}

const ZYG_LABEL: Record<AnnotatedVariant["zygosity"], string> = {
  heterozygous: "het",
  homozygous: "hom",
  hemizygous: "hemi",
  unknown: "—",
};

export default function IntakePage() {
  const router = useRouter();
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [dragging, setDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string>("");
  const [annotated, setAnnotated] = React.useState<AnnotatedVariant[]>([]);
  const [selectedIdx, setSelectedIdx] = React.useState<number | null>(null);
  const [context, setContext] = React.useState("cancer");
  const [launching, setLaunching] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const fail = React.useCallback((msg: string) => {
    setError(msg);
    setPhase("error");
  }, []);

  const handleFile = React.useCallback(
    async (file: File) => {
      setFileName(file.name);
      setError(null);
      if (file.size > MAX_BYTES) {
        fail("That file is larger than 25 MB. Please upload a smaller VCF.");
        return;
      }
      setPhase("reading");
      let text: string;
      try {
        text = await readVariantText(file);
      } catch (e) {
        fail((e as Error).message || "Couldn't read that file.");
        return;
      }
      const parsed = parseVcf(text);
      if (!parsed.ok) {
        fail(parsed.reason);
        return;
      }
      setPhase("annotating");
      try {
        const ann = await annotateVariants(parsed.variants);
        const firstFound = ann.findIndex((a) => a.found);
        if (firstFound < 0) {
          fail(
            "None of the variants in this file could be matched to a gene. Check that it's GRCh38 with valid rsIDs or coordinates.",
          );
          return;
        }
        setAnnotated(ann);
        setSelectedIdx(firstFound);
        setPhase("ready");
        if (parsed.truncated) {
          toast.message(`Showing the first ${parsed.variants.length} variants from a larger file.`);
        }
      } catch {
        fail("Couldn't reach the gene-annotation service. Check your connection and try again.");
      }
    },
    [fail],
  );

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function reset() {
    setPhase("idle");
    setError(null);
    setAnnotated([]);
    setSelectedIdx(null);
    setFileName("");
  }

  function analyze() {
    if (selectedIdx == null) return;
    const v = annotated[selectedIdx];
    if (!v?.found) {
      toast.error("Pick a variant that resolved to a gene.");
      return;
    }
    if (!context) {
      toast.error("Choose what you're testing for.");
      return;
    }
    const runId = crypto.randomUUID();
    setLaunching(true);
    // Fire the real pipeline (Inngest + Watcher); the live session subscribes to it.
    startRun({ runId, variant: v.query, clinicalContext: context }).catch(() => {});
    const q = new URLSearchParams({ live: "1", variant: v.query, context });
    if (v.gene) q.set("gene", v.gene);
    router.push(`/session/${runId}?${q.toString()}`);
  }

  const busy = phase === "reading" || phase === "annotating";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl space-y-8">
        <header className="space-y-3 text-center">
          <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            <Dna className="size-3.5" /> VUS Resolver
          </span>
          <h1 className="text-balance font-serif text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-[2.75rem]">
            Upload your sequencing file.
          </h1>
          <p className="text-pretty mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
            We&rsquo;ll read every variant, find the one of uncertain significance,
            research it across species, and explain what it means in plain language.
          </p>
        </header>

        {phase !== "ready" && (
          <>
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
                busy && "pointer-events-none opacity-80",
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
                  {phase === "reading"
                    ? "Reading your file…"
                    : phase === "annotating"
                      ? "Annotating variants across the genome…"
                      : "Drop a VCF file here, or click to browse"}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {fileName && busy ? fileName : ".vcf or .vcf.gz · up to 25 MB"}
                </span>
              </span>
              <input
                ref={fileRef}
                type="file"
                accept=".vcf,.vcf.gz,.gz,.txt,text/plain"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
            </button>

            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" />
              Your file is read in your browser. Only the variant location is sent to
              look up the gene — nothing is stored.
            </p>

            {phase === "error" && error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive">
                {error}
                <div className="mt-2">
                  <button onClick={reset} className="text-xs underline underline-offset-2 hover:no-underline">
                    Try another file
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {phase === "ready" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <FileText className="size-4 text-muted-foreground" />
                {annotated.filter((a) => a.found).length} variant
                {annotated.filter((a) => a.found).length === 1 ? "" : "s"} found
                <span className="font-mono text-xs text-muted-foreground">{fileName}</span>
              </div>
              <button onClick={reset} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
                Upload another
              </button>
            </div>

            <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {annotated.map((a) => {
                const selectable = a.found;
                const selected = a.index === selectedIdx;
                return (
                  <li key={a.index}>
                    <button
                      type="button"
                      disabled={!selectable}
                      onClick={() => setSelectedIdx(a.index)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-colors",
                        selectable ? "hover:border-foreground/30 hover:bg-accent/40" : "opacity-50",
                        selected && "border-primary ring-1 ring-primary",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full border",
                          selected ? "border-primary bg-primary text-primary-foreground" : "border-border",
                        )}
                      >
                        {selected && <Check className="size-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className="font-mono text-sm font-semibold text-foreground">
                            {a.gene ?? "—"}
                          </span>
                          {a.proteinChange && (
                            <span className="truncate font-mono text-xs text-muted-foreground">
                              {a.proteinChange}
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {a.found ? a.consequence : "no gene match"} · {a.rsid ?? `${a.chrom}:${a.pos}`}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                        {ZYG_LABEL[a.zygosity]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">What is this testing for?</label>
              <Select value={context} onValueChange={setContext}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLINICAL_CONTEXT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={analyze} disabled={launching || selectedIdx == null} className="w-full gap-2">
              {launching ? "Starting…" : "Investigate this variant"}
              {!launching && <ArrowRight className="size-4" />}
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
