// The VUS Watcher — a per-cadence scheduled function. On each tick it re-runs
// the live ClinVar (via MyVariant) + IMPC queries for every registered variant
// and diffs against the stored Step-6 snapshot. The CADENCE is config
// (lib/pipeline/config WATCH_CRON), the LOGIC is production logic — see
// docs/WATCHER.md for the "no mocks" framing. On the overwhelmingly likely tick
// it reports "no change" against the real APIs; the "change found" branch is the
// same real code path.

import { inngest } from "@/inngest/client";
import { vusRunChannel } from "@/inngest/channels";
import { WATCH_CRON } from "@/lib/pipeline/config";
import { myvariant } from "@/lib/connectors/myvariant";
import { impc } from "@/lib/connectors/impc";
import { narrate } from "@/lib/grok";
import {
  getOutput,
  getSnapshot,
  listWatch,
  saveOutput,
  saveSnapshot,
  updateWatch,
  type WatchEntry,
} from "@/lib/store";
import type { RealtimeEvent } from "@/lib/types";

type StepCtx = { run: <T>(id: string, fn: () => Promise<T>) => Promise<T> };
type PublishFn = (msg: unknown) => Promise<unknown>;

async function recheckOne(
  entry: WatchEntry,
  step: StepCtx,
  publish: PublishFn,
): Promise<{ runId: string; changed: boolean; note: string }> {
  const snap = await step.run(`snap-${entry.runId}`, () => getSnapshot(entry.runId));
  const checkedAt = new Date().toISOString();
  const pub = (key: string, ev: RealtimeEvent) =>
    step.run(`wpub-${entry.runId}-${key}`, async () => {
      await publish(vusRunChannel(entry.runId).events(ev));
      return { key };
    });

  if (!snap) {
    await step.run(`wupd-${entry.runId}-nosnap`, async () => {
      await updateWatch(entry.runId, { lastCheckedAt: checkedAt, lastResult: "no snapshot to compare", changeFound: false });
      return null;
    });
    return { runId: entry.runId, changed: false, note: "no snapshot" };
  }

  // Live re-query (same connectors as the main pipeline).
  const mv = await step.run(`recheck-mv-${entry.runId}`, () => myvariant({ variant: entry.variant }));
  let mpTermIds: string[] = [];
  let phenotypeCount = snap.impcPhenotypeCount;
  if (snap.mouseGeneSymbol) {
    const r = await step.run(`recheck-impc-${entry.runId}`, () =>
      impc({ mouseGeneSymbol: snap.mouseGeneSymbol as string }),
    );
    mpTermIds = r.result.mpTermIds;
    phenotypeCount = r.result.phenotypeCount;
  }

  const newSig = mv.parsed.clinvarSignificance ?? null;
  const sigChanged = newSig !== (snap.clinvarSignificance ?? null);
  const newMp = mpTermIds.filter((id) => !snap.impcMpTermIds.includes(id));
  const changed = sigChanged || newMp.length > 0;

  if (!changed) {
    await step.run(`wupd-${entry.runId}-nochg`, async () => {
      await updateWatch(entry.runId, { lastCheckedAt: checkedAt, lastResult: "checked — no change", changeFound: false });
      return null;
    });
    await pub("nochange", {
      type: "narration",
      data: `Re-checked ${entry.geneSymbol} ${entry.variant} against live ClinVar + IMPC — no change yet.`,
    });
    return { runId: entry.runId, changed: false, note: "no change" };
  }

  const note = [
    sigChanged ? `ClinVar significance changed from '${snap.clinvarSignificance ?? "none"}' to '${newSig ?? "none"}'` : null,
    newMp.length ? `${newMp.length} new IMPC phenotype call(s)` : null,
  ]
    .filter(Boolean)
    .join("; ");

  const spoken = await step.run(`watch-grok-${entry.runId}`, () =>
    narrate(`The evidence for ${entry.geneSymbol} ${entry.variant} changed: ${note}. Explain to the patient, plainly, what this means and that they should revisit the brief with their doctor.`),
  );

  await step.run(`watch-save-${entry.runId}`, async () => {
    await saveSnapshot({
      ...snap,
      clinvarSignificance: newSig,
      impcMpTermIds: mpTermIds.length ? mpTermIds : snap.impcMpTermIds,
      impcPhenotypeCount: phenotypeCount,
      takenAt: checkedAt,
    });
    await updateWatch(entry.runId, { lastCheckedAt: checkedAt, lastResult: `update found: ${note}`, changeFound: true });

    const existing = await getOutput(entry.runId);
    if (existing) {
      const updateBlock = `Update (${checkedAt}): ${note}. ${spoken}`;
      await saveOutput(entry.runId, {
        evidenceCard: {
          ...existing.evidenceCard,
          plainLanguageSummary: `${existing.evidenceCard.plainLanguageSummary}\n\n${updateBlock}`,
          generatedAt: checkedAt,
        },
        doctorBrief: {
          ...existing.doctorBrief,
          summary: `${existing.doctorBrief.summary}\n\n${updateBlock}`,
          generatedAt: checkedAt,
        },
      });
    }
    return null;
  });

  await pub("change-narr", { type: "narration", data: `Update for ${entry.geneSymbol}: ${note}. ${spoken}` });
  await pub("change-complete", { type: "complete", briefUrl: `/brief/${entry.runId}` });

  return { runId: entry.runId, changed: true, note };
}

export const watcher = inngest.createFunction(
  { id: "vus-watcher", name: "VUS Watcher (live re-check)" },
  // Two triggers: the production cron cadence, plus an on-demand event so the
  // re-check can be forced during a demo (or tested) without waiting for the cron.
  [{ cron: WATCH_CRON }, { event: "vus.watch.recheck" }],
  async ({ step, publish }) => {
    const entries = await step.run("load-watchlist", () => listWatch());
    const results: { runId: string; changed: boolean; note: string }[] = [];
    for (const entry of entries) {
      results.push(await recheckOne(entry, step as StepCtx, publish as PublishFn));
    }
    return { checkedAt: new Date().toISOString(), checked: entries.length, results };
  },
);
