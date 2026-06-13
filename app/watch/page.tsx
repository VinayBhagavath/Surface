// /watch — the Watcher dashboard. A variant flagged "uncertain" today may be reclassifiable
// tomorrow as ClinVar / gnomAD / IMPC refresh; Person A's Inngest cron Watcher re-runs each
// registered variant on a cadence and flags changes. Placeholder rows for now (same shape the
// Watcher will write); the re-check interval is shown per row — the cadence is the credibility story.
import Link from "next/link";
import { ArrowLeft, BellRing, CircleCheck, Clock, Eye } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type WatchRow = {
  gene: string;
  variant: string;
  clinicalContext: string;
  recheck: string; // configured cron cadence
  lastChecked: string; // ISO
  status: "no_change" | "update";
  demo: string; // links the updated brief in fixture mode
};

// PERSON A: the Watcher (inngest/watcher.ts) will populate this read model at merge.
const WATCHED: WatchRow[] = [
  {
    gene: "LDLR",
    variant: "rs879254403",
    clinicalContext: "Hypercholesterolemia",
    recheck: "every 24 h",
    lastChecked: "2026-06-13T02:00:00Z",
    status: "no_change",
    demo: "ldlr",
  },
  {
    gene: "CACNA1C",
    variant: "rs776805699",
    clinicalContext: "Arrhythmia",
    recheck: "every 24 h",
    lastChecked: "2026-06-13T02:00:00Z",
    status: "update",
    demo: "cacna1c",
  },
  {
    gene: "KCNQ1",
    variant: "rs2133727494",
    clinicalContext: "Long-QT",
    recheck: "every 12 h",
    lastChecked: "2026-06-13T08:00:00Z",
    status: "no_change",
    demo: "kcnq1",
  },
];

function fmtDate(iso: string): string {
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]} UTC` : iso;
}

function StatusCell({ row }: { row: WatchRow }) {
  if (row.status === "update") {
    return (
      <div className="flex flex-col gap-1">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-confidence-low-soft px-2.5 py-0.5 text-xs font-medium text-confidence-low-ink">
          <BellRing className="size-3.5" /> Update found
        </span>
        <Link
          href={`/brief/${row.demo}-watch?demo=${row.demo}`}
          className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          View updated brief →
        </Link>
      </div>
    );
  }
  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-confidence-high-soft px-2.5 py-0.5 text-xs font-medium text-confidence-high-ink">
      <CircleCheck className="size-3.5" /> Checked — no change
    </span>
  );
}

export default function WatchPage() {
  const updates = WATCHED.filter((w) => w.status === "update").length;

  return (
    <main className="surface-grid min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back to intake
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <Eye className="size-3.5" /> Reclassification watch
              </span>
              <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight text-foreground">
                Watched variants
              </h1>
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              Each variant is automatically re-run on its cadence. When the underlying
              evidence shifts, the brief is regenerated and flagged here.
            </p>
          </div>
          {updates > 0 && (
            <div className="flex items-center gap-2 rounded-xl border-l-[3px] border-l-confidence-low bg-confidence-low-soft/40 px-4 py-2.5 text-sm">
              <BellRing className="size-4 text-confidence-low-ink" />
              <span className="text-foreground">
                {updates} variant{updates > 1 ? "s have" : " has"} a new result since last review.
              </span>
            </div>
          )}
        </header>

        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Variant</TableHead>
                <TableHead className="hidden sm:table-cell">Clinical context</TableHead>
                <TableHead>Re-check</TableHead>
                <TableHead className="hidden md:table-cell">Last checked</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {WATCHED.map((row) => (
                <TableRow key={row.variant} className="align-top">
                  <TableCell>
                    <div className="font-serif text-sm font-semibold text-foreground">
                      {row.gene}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {row.variant}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                    {row.clinicalContext}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
                      <Clock className="size-3.5" /> {row.recheck}
                    </span>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                    {fmtDate(row.lastChecked)}
                  </TableCell>
                  <TableCell>
                    <StatusCell row={row} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <p className={cn("text-center font-mono text-[0.65rem] text-muted-foreground/70")}>
          Placeholder data — Person A&rsquo;s Inngest cron Watcher populates this at integration.
        </p>
      </div>
    </main>
  );
}
