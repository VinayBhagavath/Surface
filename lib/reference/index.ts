// Typed loaders over the curated reference JSON.

import geneMechanismRaw from "@/lib/reference/gene-mechanism.json";
import panelToHpoRaw from "@/lib/reference/panel-to-hpo.json";

export type InheritanceMode = "dominant" | "recessive" | "x-linked" | "both";
export type DiseaseMechanism = "LoF" | "GoF" | "both";

export type GeneMechanism = {
  inheritanceMode: InheritanceMode;
  mechanism: DiseaseMechanism;
  notes: string;
  source?: string;
};

const geneMechanism = geneMechanismRaw as unknown as Record<string, GeneMechanism | { _meta: unknown }>;
const panelToHpo = panelToHpoRaw as unknown as Record<string, string[] | { _meta: unknown }>;

/** Look up a gene's documented mechanism/inheritance. Returns null when the
 *  gene isn't in the curated table — the gate must then proceed WITHOUT a
 *  mechanism prior (Grok is told mechanism is unknown, gate stays cautious). */
export function getGeneMechanism(symbol: string): GeneMechanism | null {
  const entry = geneMechanism[symbol?.toUpperCase()];
  if (!entry || "_meta" in entry) return null;
  return entry as GeneMechanism;
}

/** Mouse IMPC zygosity that matches a human inheritance mode. */
export function zygosityForInheritance(
  mode: InheritanceMode | null,
): "homozygote" | "heterozygote" | "hemizygote" | null {
  switch (mode) {
    case "dominant":
      return "heterozygote";
    case "recessive":
      return "homozygote";
    case "x-linked":
      return "hemizygote";
    case "both":
    case null:
    default:
      return null; // no constraint — take whatever zygosity IMPC reports
  }
}

function normalizeContext(context: string): string {
  return context.trim().toLowerCase().replace(/[\s/]+/g, "_");
}

/** HPO term IDs for an intake clinical-context string. Tries an exact key,
 *  then a substring match against known panels. Empty array means "no mapped
 *  HPO terms" — Monarch then has only the mouse side and Step 5 leans on the
 *  raw MP terms. */
export function hpoTermsForContext(context: string): string[] {
  if (!context) return [];
  const key = normalizeContext(context);
  const direct = panelToHpo[key];
  if (Array.isArray(direct)) return direct;
  for (const [k, v] of Object.entries(panelToHpo)) {
    if (k === "_meta" || !Array.isArray(v)) continue;
    if (key.includes(k) || k.includes(key)) return v;
  }
  return [];
}

export function availablePanels(): string[] {
  return Object.keys(panelToHpo).filter((k) => k !== "_meta");
}
