"use client";

// Intake — the landing page. Variant + clinical context → emit the pipeline event →
// /session/[runId]. In fixture mode the session replays a demo run (`?demo=`); at Step 9
// the live subscription ignores that hint and streams the real run by runId.

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Dna, Upload, FlaskConical } from "lucide-react";
import { toast } from "sonner";

import { startRun } from "@/app/actions/start-run";
import { CLINICAL_CONTEXT_OPTIONS } from "@/lib/clinical-context-options";
import { type DemoId } from "@/fixtures/runs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type DemoPreset = {
  id: DemoId;
  gene: string;
  variant: string;
  clinicalContext: string;
  scenario: string;
  tone: string; // confidence token class for the accent dot
};

const DEMO_PRESETS: DemoPreset[] = [
  {
    id: "ldlr",
    gene: "LDLR",
    variant: "rs879254403",
    clinicalContext: "hypercholesterolemia",
    scenario: "Gate open — everything agrees",
    tone: "bg-confidence-high",
  },
  {
    id: "cacna1c",
    gene: "CACNA1C",
    variant: "rs776805699",
    clinicalContext: "arrhythmia",
    scenario: "Gate closed — mouse signal suppressed",
    tone: "bg-confidence-low",
  },
  {
    id: "kcnq1",
    gene: "KCNQ1",
    variant: "rs2133727494",
    clinicalContext: "long_qt",
    scenario: "Low — predictor disagreement",
    tone: "bg-confidence-pending",
  },
];

/** In fixture mode, map a chosen context to the closest demo run. */
function pickDemo(context: string): DemoId {
  if (context === "arrhythmia" || context === "cardiomyopathy") return "cacna1c";
  if (context === "long_qt") return "kcnq1";
  return "ldlr";
}

function parseVcf(text: string): string[] {
  const variants: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const cols = line.split("\t");
    if (cols.length < 5) continue;
    const [chrom, pos, id, ref, alt] = cols;
    if (!chrom || !pos) continue;
    variants.push(id && id !== "." ? id : `${chrom}-${pos}-${ref}-${alt}`);
    if (variants.length >= 25) break;
  }
  return variants;
}

export default function IntakePage() {
  const router = useRouter();
  const [variant, setVariant] = React.useState("");
  const [context, setContext] = React.useState("");
  const [vcfVariants, setVcfVariants] = React.useState<string[]>([]);
  const [pending, startTransition] = React.useTransition();
  const fileRef = React.useRef<HTMLInputElement>(null);

  function launch(v: string, ctx: string, demo?: DemoId) {
    const variantValue = v.trim();
    if (!variantValue) {
      toast.error("Enter a variant — an rsID or HGVS notation.");
      return;
    }
    if (!ctx) {
      toast.error("Choose a clinical context.");
      return;
    }
    const runId = crypto.randomUUID();
    const demoId = demo ?? pickDemo(ctx);
    startTransition(async () => {
      try {
        // Emit the pipeline request. Best-effort here: on Person B's branch no
        // pipeline consumes it yet, and the live join happens at Step 9.
        await startRun({ runId, variant: variantValue, clinicalContext: ctx });
      } catch {
        // Inngest dev server may not be running in fixture-only mode — proceed anyway.
      }
      router.push(`/session/${runId}?demo=${demoId}`);
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    launch(variant, context);
  }

  function onPickDemo(d: DemoPreset) {
    setVariant(d.variant);
    setContext(d.clinicalContext);
    launch(d.variant, d.clinicalContext, d.id);
  }

  async function onVcfFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const found = parseVcf(text);
    if (found.length === 0) {
      toast.error("No variants found in that VCF.");
      return;
    }
    setVcfVariants(found);
    setVariant(found[0]);
    toast.success(
      found.length === 1
        ? `Loaded ${found[0]} from VCF.`
        : `Loaded ${found.length} variants — pick one below.`,
    );
    e.target.value = "";
  }

  return (
    <main className="surface-grid flex min-h-screen flex-col items-center px-6 py-16 sm:py-24">
      <div className="w-full max-w-xl space-y-10">
        <header className="space-y-4 text-center">
          <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            <Dna className="size-3.5" /> VUS Resolver
          </span>
          <h1 className="text-balance font-serif text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl">
            Resolve a variant of uncertain significance.
          </h1>
          <p className="text-pretty mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
            Give the agent a variant and the clinical question. Watch it gather
            cross-species evidence in real time, gate it by mechanism, and write a
            confidence-scored doctor&rsquo;s brief.
          </p>
        </header>

        <form
          onSubmit={onSubmit}
          className="space-y-5 rounded-2xl border bg-card p-6 shadow-sm sm:p-7"
        >
          <div className="space-y-2">
            <label
              htmlFor="variant"
              className="flex items-center justify-between text-sm font-medium text-foreground"
            >
              Variant
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 font-mono text-[0.7rem] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
              >
                <Upload className="size-3.5" /> Upload VCF
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".vcf,.txt,text/plain"
                className="hidden"
                onChange={onVcfFile}
              />
            </label>
            <Input
              id="variant"
              value={variant}
              onChange={(e) => setVariant(e.target.value)}
              placeholder="rs2133727494  or  NM_000218.3:c.581C>T"
              className="font-mono"
              autoComplete="off"
              spellCheck={false}
            />
            {vcfVariants.length > 1 && (
              <Select value={variant} onValueChange={setVariant}>
                <SelectTrigger className="w-full font-mono text-xs">
                  <SelectValue placeholder="Pick a variant from your VCF" />
                </SelectTrigger>
                <SelectContent>
                  {vcfVariants.map((v) => (
                    <SelectItem key={v} value={v} className="font-mono text-xs">
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="context" className="text-sm font-medium text-foreground">
              Clinical context
            </label>
            <Select value={context} onValueChange={setContext}>
              <SelectTrigger id="context" className="w-full">
                <SelectValue placeholder="What are we testing for?" />
              </SelectTrigger>
              <SelectContent>
                {CLINICAL_CONTEXT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full gap-2" disabled={pending}>
            {pending ? "Starting…" : "Resolve variant"}
            {!pending && <ArrowRight className="size-4" />}
          </Button>
        </form>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <FlaskConical className="size-3.5" />
            Or try a captured demo run
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {DEMO_PRESETS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => onPickDemo(d)}
                disabled={pending}
                className="group flex flex-col gap-1.5 rounded-xl border bg-card p-3.5 text-left transition-colors hover:border-foreground/20 hover:bg-accent disabled:opacity-60"
              >
                <div className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", d.tone)} />
                  <span className="font-mono text-sm font-semibold text-foreground">
                    {d.gene}
                  </span>
                </div>
                <span className="text-[0.7rem] leading-snug text-muted-foreground">
                  {d.scenario}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
