// xAI / Grok client — the SINGLE path every server-side Grok call goes through.
//
// xAI exposes an OpenAI-compatible API, so we use the `openai` SDK pointed at
// api.x.ai/v1. Config (key, base URL, model) comes from one place: getXaiConfig().
// There is exactly one model string in the app: grok-4.3 via XAI_MODEL.
//
// Two transports, one wrapper contract:
//   • chat.completions  — default; used for free-text and the lighter JSON calls.
//   • responses          — used when a call opts into reasoning (`reasoningEffort`).
//     Reasoning effort is ONLY available on xAI's Responses API; the wrapper's
//     external contract is identical either way (schema-validated object, one
//     self-repair retry), so callers don't care which transport ran.

import OpenAI from "openai";
import type { ZodType } from "zod";
import { getXaiConfig } from "@/lib/env";

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) {
    const cfg = getXaiConfig();
    // Generous client-level ceiling; per-call timeouts (below) tighten it.
    _client = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseUrl, timeout: 120_000, maxRetries: 1 });
  }
  return _client;
}

export type ReasoningEffort = "low" | "medium" | "high";

export type GrokOpts = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Opt into Responses-API reasoning (slower, more deliberate). Omit for the
   *  default chat path (grok-4.3 still reasons lightly there by default). */
  reasoningEffort?: ReasoningEffort;
  /** Per-call timeout. Defaults: 45s for non-reasoning, 120s for reasoning. */
  timeoutMs?: number;
  /** Short tag for the per-call usage log line. */
  label?: string;
};

// ── usage logging ───────────────────────────────────────────────────────────
// One concise line per call. On in dev; in prod only when GROK_DEBUG=1.
function logUsage(label: string, model: string, usage: unknown, ms: number) {
  if (process.env.GROK_DEBUG !== "1" && process.env.NODE_ENV === "production") return;
  const u = (usage ?? {}) as Record<string, unknown>;
  const inTok = u.prompt_tokens ?? u.input_tokens ?? "?";
  const outTok = u.completion_tokens ?? u.output_tokens ?? "?";
  const reasoning =
    ((u.completion_tokens_details as Record<string, unknown> | undefined)?.reasoning_tokens ??
      (u.output_tokens_details as Record<string, unknown> | undefined)?.reasoning_tokens) ??
    0;
  const cost = u.cost_in_usd_ticks;
  console.log(
    `[grok] ${label} model=${model} ${ms}ms in=${inTok} out=${outTok} reasoning=${reasoning}` +
      (cost != null ? ` cost_ticks=${cost}` : ""),
  );
}

function looksLikeJsonModeError(msg: string): boolean {
  return /response_format|json[_\s-]?mode|json[_\s-]?object|unsupported/i.test(msg);
}

// ── chat.completions transport ───────────────────────────────────────────────
async function chatCompletion(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  base: { model: string; temperature: number; max_tokens: number },
  useJsonMode: boolean,
  timeoutMs: number,
  label: string,
): Promise<string> {
  const t = Date.now();
  try {
    const res = await client().chat.completions.create(
      {
        ...base,
        ...(useJsonMode ? { response_format: { type: "json_object" as const } } : {}),
        messages,
      },
      { timeout: timeoutMs },
    );
    logUsage(label, base.model, res.usage, Date.now() - t);
    return res.choices[0]?.message?.content?.trim() ?? "";
  } catch (e) {
    const msg = (e as Error).message ?? "";
    // Transient, per-call fallback: if THIS request was rejected for json mode,
    // retry it once without json mode. We do NOT disable json mode globally —
    // one transient error must not downgrade every later call in the process.
    if (useJsonMode && looksLikeJsonModeError(msg)) {
      return chatCompletion(messages, base, false, timeoutMs, label);
    }
    throw e;
  }
}

// ── responses transport (reasoning) ──────────────────────────────────────────
type InputItem = { role: "user" | "assistant"; content: string };

async function reasoningResponse(
  instructions: string,
  input: InputItem[],
  base: { model: string; max_output_tokens: number; effort: ReasoningEffort },
  timeoutMs: number,
  label: string,
): Promise<string> {
  const t = Date.now();
  const res = await client().responses.create(
    {
      model: base.model,
      instructions,
      input,
      // Reasoning effort is the whole point of this path. Reasoning models reject
      // presence_penalty / frequency_penalty / stop, so we never send them.
      reasoning: { effort: base.effort },
      max_output_tokens: base.max_output_tokens,
    } as OpenAI.Responses.ResponseCreateParamsNonStreaming,
    { timeout: timeoutMs },
  );
  logUsage(label, base.model, res.usage, Date.now() - t);
  return (res.output_text ?? "").trim();
}

// ── free text ─────────────────────────────────────────────────────────────────
export async function callGrokText(
  system: string,
  user: string,
  opts: GrokOpts = {},
): Promise<string> {
  const cfg = getXaiConfig();
  return chatCompletion(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    {
      model: opts.model ?? cfg.model,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 600,
    },
    false,
    opts.timeoutMs ?? 45_000,
    opts.label ?? "text",
  );
}

/** Pull the first balanced JSON object out of a model response (handles stray
 *  prose or code fences that slip past json mode / reasoning output). */
function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

const JSON_SUFFIX =
  "\n\nRespond with ONLY a single valid JSON object matching the requested schema. No prose, no markdown, no code fences.";

export async function callGrokJSON<T>(
  system: string,
  user: string,
  schema: ZodType<T>,
  opts: GrokOpts = {},
): Promise<T> {
  const cfg = getXaiConfig();
  const model = opts.model ?? cfg.model;
  const maxTokens = opts.maxTokens ?? 1500;
  const label = opts.label ?? "json";
  const reasoning = opts.reasoningEffort;
  const instructions = system + JSON_SUFFIX;

  // Conversation carried across the (one) self-repair retry. For the responses
  // path the system text is `instructions`; for chat it's the first message.
  const input: InputItem[] = [{ role: "user", content: user }];
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: instructions },
    { role: "user", content: user },
  ];

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const content = reasoning
      ? await reasoningResponse(
          instructions,
          input,
          {
            model,
            // reasoning tokens consume the output budget — leave generous headroom.
            max_output_tokens: maxTokens + 2500,
            effort: reasoning,
          },
          opts.timeoutMs ?? 120_000,
          label,
        )
      : await chatCompletion(
          messages,
          { model, temperature: opts.temperature ?? 0.2, max_tokens: maxTokens },
          true,
          opts.timeoutMs ?? 45_000,
          label,
        );
    try {
      return schema.parse(JSON.parse(extractJson(content)));
    } catch (e) {
      lastErr = e;
      const correction = `That response did not match the required schema (${(e as Error).message}). Return ONLY corrected JSON, nothing else.`;
      input.push({ role: "assistant", content }, { role: "user", content: correction });
      messages.push({ role: "assistant", content }, { role: "user", content: correction });
    }
  }
  throw new Error(
    `Grok JSON (${label}) did not validate after retry: ${(lastErr as Error)?.message ?? lastErr}`,
  );
}

// ── web search (Live Search) ──────────────────────────────────────────────────
// A schema-validated JSON call that may use xAI's server-side web_search tool,
// returning the parsed object PLUS the real source citations the model used, so
// callers can keep researched facts separated from measured evidence.
export type GrokCitation = { url: string; title: string | null };

type CitationAnnotation = { type?: string; url?: string; title?: string };
type OutputContentPart = { annotations?: CitationAnnotation[] };
type OutputItem = { type?: string; content?: OutputContentPart[] };

function extractCitations(res: { output?: unknown }): GrokCitation[] {
  const items = (res.output as OutputItem[] | undefined) ?? [];
  const out: GrokCitation[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (item?.type !== "message") continue;
    for (const part of item.content ?? []) {
      for (const ann of part.annotations ?? []) {
        if (ann?.type === "url_citation" && ann.url && !seen.has(ann.url)) {
          seen.add(ann.url);
          out.push({ url: ann.url, title: ann.title ?? null });
        }
      }
    }
  }
  return out;
}

export async function callGrokWebSearchJSON<T>(
  system: string,
  user: string,
  schema: ZodType<T>,
  opts: GrokOpts = {},
): Promise<{ data: T; citations: GrokCitation[] }> {
  const cfg = getXaiConfig();
  const model = opts.model ?? cfg.model;
  const label = opts.label ?? "web-search";
  const t = Date.now();
  const res = await client().responses.create(
    {
      model,
      instructions: system + JSON_SUFFIX,
      input: [{ role: "user", content: user }],
      reasoning: { effort: opts.reasoningEffort ?? "low" },
      tools: [{ type: "web_search" }],
      max_output_tokens: (opts.maxTokens ?? 800) + 3000, // reasoning + search summary headroom
    } as OpenAI.Responses.ResponseCreateParamsNonStreaming,
    { timeout: opts.timeoutMs ?? 120_000 },
  );
  logUsage(label, model, res.usage, Date.now() - t);
  const text = (res.output_text ?? "").trim();
  const citations = extractCitations(res as { output?: unknown });
  const data = schema.parse(JSON.parse(extractJson(text)));
  return { data, citations };
}
