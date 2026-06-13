// Lazy, validated access to environment configuration.
//
// Everything reads process.env at *call time* (not module-init time) so that
// dev scripts which call `process.loadEnvFile(".env.local")` before invoking a
// connector or the Grok client still observe the values. Genomics connectors
// need no env at all (all five public APIs are keyless); only Grok + the
// optional KV store read anything here.

export type XaiConfig = { apiKey: string; baseUrl: string; model: string };

export function hasXai(): boolean {
  return Boolean(process.env.XAI_API_KEY);
}

/** Whether to use xAI Live Search (Responses-API web_search tool). Requires a
 *  key and is on by default; set XAI_WEB_SEARCH=0 to disable. When off, the
 *  pipeline still runs — scoped research is strictly additive. */
export function webSearchEnabled(): boolean {
  return hasXai() && process.env.XAI_WEB_SEARCH !== "0";
}

export function getXaiConfig(): XaiConfig {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "XAI_API_KEY is not set. Add it to .env.local (see .env.example). " +
        "Grok reasoning/narration calls cannot run without it.",
    );
  }
  return {
    apiKey,
    baseUrl: process.env.XAI_BASE_URL || "https://api.x.ai/v1",
    model: process.env.XAI_MODEL || "grok-4.3",
  };
}

/** Vercel KV / Upstash REST credentials, if configured. When absent, the store
 *  falls back to an in-process Map (fine for `inngest-cli dev`, not for
 *  multi-instance serverless — see lib/store.ts). */
export function getKvConfig(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return { url, token };
  return null;
}
