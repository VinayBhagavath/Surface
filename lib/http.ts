// Small fetch wrapper shared by every connector.
//
// Contract: throws on a genuine HTTP/network failure (so Inngest's step retry
// kicks in), retries transient 5xx/429/network errors a couple of times, and
// returns parsed JSON otherwise. A real query that returns an empty *result*
// is NOT an error — that's the connector's job to express as `found: false`.

export class HttpError extends Error {
  constructor(
    public status: number,
    public url: string,
    public body: string,
  ) {
    super(`HTTP ${status} for ${url}: ${body.slice(0, 200)}`);
    this.name = "HttpError";
  }
}

export type FetchJsonOptions = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  retries?: number; // retry attempts on network error / 5xx / 429
  retryDelayMs?: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchJson<T = unknown>(
  url: string,
  opts: FetchJsonOptions = {},
): Promise<T> {
  const {
    method = "GET",
    headers = {},
    body,
    timeoutMs = 20_000,
    retries = 2,
    retryDelayMs = 600,
  } = opts;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method, headers, body, signal: controller.signal });
      clearTimeout(timer);
      const text = await res.text();

      if (!res.ok) {
        const transient = res.status >= 500 || res.status === 429;
        if (transient && attempt < retries) {
          await sleep(retryDelayMs * (attempt + 1));
          continue;
        }
        throw new HttpError(res.status, url, text);
      }

      if (!text) return undefined as T;
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 200)}`);
      }
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof HttpError) throw err; // already decided not to retry
      lastErr = err; // network/abort/parse error
      if (attempt < retries) {
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Build a query string from a record, skipping null/undefined. */
export function qs(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
