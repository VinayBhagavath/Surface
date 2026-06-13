// Run-output + Watcher snapshot store.
//
// Two backends, picked at runtime:
//   • In-memory (default) — a Map stashed on globalThis so it survives Next's
//     HMR. Works for `inngest-cli dev` + `next dev` because the pipeline step
//     and the /api/brief route execute in the SAME Node process. NOT durable
//     across serverless instances.
//   • Upstash / Vercel KV (when KV_REST_API_URL + KV_REST_API_TOKEN are set) —
//     the production path. Use this on Vercel where each request is a separate
//     invocation. See docs/DEPLOY.md.
//
// The Watcher's snapshot diffing depends on this persisting between the
// pipeline run and the scheduled re-check.

import { getKvConfig } from "@/lib/env";
import type { ConfidenceLabel, RunOutput } from "@/lib/types";

export type WatchSnapshot = {
  runId: string;
  variant: string;
  geneSymbol: string;
  mouseGeneSymbol: string | null;
  clinvarSignificance: string | null;
  impcPhenotypeCount: number;
  impcMpTermIds: string[];
  overall: ConfidenceLabel;
  takenAt: string;
};

export type WatchEntry = {
  runId: string;
  variant: string;
  geneSymbol: string;
  clinicalContext: string;
  intervalCron: string;
  registeredAt: string;
  lastCheckedAt: string | null;
  lastResult: string | null; // "no change" | "update found: ..."
  changeFound: boolean;
};

interface Backend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

// ─── In-memory backend (HMR-safe via globalThis) ─────────────────────────────

const g = globalThis as unknown as { __vusStore?: Map<string, string> };
if (!g.__vusStore) g.__vusStore = new Map();
const mem = g.__vusStore;

const memoryBackend: Backend = {
  async get(key) {
    return mem.has(key) ? (mem.get(key) as string) : null;
  },
  async set(key, value) {
    mem.set(key, value);
  },
};

// ─── Upstash / Vercel KV REST backend ────────────────────────────────────────

function upstashBackend(url: string, token: string): Backend {
  const exec = async (cmd: unknown[]): Promise<unknown> => {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmd),
    });
    if (!res.ok) throw new Error(`KV error ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { result?: unknown };
    return json.result ?? null;
  };
  return {
    async get(key) {
      const r = await exec(["GET", key]);
      return r === null || r === undefined ? null : String(r);
    },
    async set(key, value) {
      await exec(["SET", key, value]);
    },
  };
}

function backend(): Backend {
  const kv = getKvConfig();
  return kv ? upstashBackend(kv.url, kv.token) : memoryBackend;
}

export function storeMode(): "kv" | "memory" {
  return getKvConfig() ? "kv" : "memory";
}

// ─── Keys ────────────────────────────────────────────────────────────────────

const OUTPUT = (runId: string) => `vus:output:${runId}`;
const SNAPSHOT = (runId: string) => `vus:snapshot:${runId}`;
const WATCH = (runId: string) => `vus:watch:${runId}`;
const WATCH_INDEX = `vus:watch:index`;

// ─── Run output (Evidence Card + Doctor Brief) ───────────────────────────────

export async function saveOutput(runId: string, output: RunOutput): Promise<void> {
  await backend().set(OUTPUT(runId), JSON.stringify(output));
}
export async function getOutput(runId: string): Promise<RunOutput | null> {
  const raw = await backend().get(OUTPUT(runId));
  return raw ? (JSON.parse(raw) as RunOutput) : null;
}

// ─── Watcher snapshot ────────────────────────────────────────────────────────

export async function saveSnapshot(snap: WatchSnapshot): Promise<void> {
  await backend().set(SNAPSHOT(snap.runId), JSON.stringify(snap));
}
export async function getSnapshot(runId: string): Promise<WatchSnapshot | null> {
  const raw = await backend().get(SNAPSHOT(runId));
  return raw ? (JSON.parse(raw) as WatchSnapshot) : null;
}

// ─── Watchlist ───────────────────────────────────────────────────────────────

export async function registerWatch(entry: WatchEntry): Promise<void> {
  const b = backend();
  await b.set(WATCH(entry.runId), JSON.stringify(entry));
  const idxRaw = await b.get(WATCH_INDEX);
  const idx: string[] = idxRaw ? (JSON.parse(idxRaw) as string[]) : [];
  if (!idx.includes(entry.runId)) {
    idx.push(entry.runId);
    await b.set(WATCH_INDEX, JSON.stringify(idx));
  }
}

export async function listWatch(): Promise<WatchEntry[]> {
  const b = backend();
  const idxRaw = await b.get(WATCH_INDEX);
  const idx: string[] = idxRaw ? (JSON.parse(idxRaw) as string[]) : [];
  const out: WatchEntry[] = [];
  for (const runId of idx) {
    const raw = await b.get(WATCH(runId));
    if (raw) out.push(JSON.parse(raw) as WatchEntry);
  }
  return out;
}

export async function updateWatch(
  runId: string,
  patch: Partial<WatchEntry>,
): Promise<void> {
  const b = backend();
  const raw = await b.get(WATCH(runId));
  if (!raw) return;
  const entry = { ...(JSON.parse(raw) as WatchEntry), ...patch };
  await b.set(WATCH(runId), JSON.stringify(entry));
}
