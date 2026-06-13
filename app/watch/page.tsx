// /watch - reclassification Watcher dashboard backed by the real run store.
import Link from "next/link";
import { ArrowLeft, BellRing, CircleCheck, Clock, Eye, Inbox } from "lucide-react";

import { listWatch, type WatchEntry } from "@/lib/store";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string {
  if (!iso) return "Not checked yet";
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]} UTC` : iso;
}

function fmtCadence(cron: string): string {
  const m = cron.match(/^\*\/(\d+) \* \* \* \*$/);
  if (m) return `every ${m[1]} min`;
  if (cron === "0 0 * * *") return "daily";
  return cron;
}

function StatusCell({ row }: { row: WatchEntry }) {
  if (row.changeFound) {
    return (
      <div className="flex flex-col gap-1">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-confidence-low-soft px-2.5 py-0.5 text-xs font-medium text-confidence-low-ink">
          <BellRing className="size-3.5" /> Update found
        </span>
        <Link
          href={`/brief/${row.runId}?live=1`}
          className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          View updated brief
        </Link>
      </div>
    );
  }

  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-confidence-high-soft px-2.5 py-0.5 text-xs font-medium text-confidence-high-ink">
      <CircleCheck className="size-3.5" />
      {row.lastResult ?? "Registered"}
    </span>
  );
}

export default async function WatchPage() {
  const watched = await listWatch();
  const updates = watched.filter((w) => w.changeFound).length;

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
              Completed runs register here for automatic re-checks. Rows come from
              the Watcher store, not a fixture table.
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

        {watched.length === 0 ? (
          <section className="rounded-2xl border bg-card p-8 text-center shadow-sm">
            <Inbox className="mx-auto size-8 text-muted-foreground" />
            <h2 className="mt-3 font-serif text-2xl font-semibold text-foreground">
              No watched variants yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Run a live analysis to completion. The evidence pipeline registers the
              variant here after synthesis, with its re-check cadence and latest result.
            </p>
          </section>
        ) : (
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
                {watched.map((row) => (
                  <TableRow key={row.runId} className="align-top">
                    <TableCell>
                      <div className="font-serif text-sm font-semibold text-foreground">
                        {row.geneSymbol}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {row.variant}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                      {row.clinicalContext.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
                        <Clock className="size-3.5" /> {fmtCadence(row.intervalCron)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                      {fmtDate(row.lastCheckedAt)}
                    </TableCell>
                    <TableCell>
                      <StatusCell row={row} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </main>
  );
}
