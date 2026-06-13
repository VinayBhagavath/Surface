// xAI / Grok client. xAI exposes an OpenAI-compatible API, so we use the
// `openai` SDK pointed at api.x.ai/v1. Two entry points: free-text and
// schema-validated JSON (with one self-repair retry). Every call site keeps its
// own narrow prompt — see the per-step modules in this folder.

import OpenAI from "openai";
import type { ZodType } from "zod";
import { getXaiConfig } from "@/lib/env";

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) {
    const cfg = getXaiConfig();
    _client = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseUrl });
  }
  return _client;
}

export type GrokOpts = { model?: string; temperature?: number; maxTokens?: number };

let jsonModeSupported = true;

async function createCompletion(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  base: { model: string; temperature: number; max_tokens: number },
  useJsonMode: boolean,
): Promise<string> {
  try {
    const res = await client().chat.completions.create({
      ...base,
      ...(useJsonMode ? { response_format: { type: "json_object" as const } } : {}),
      messages,
    });
    return res.choices[0]?.message?.content?.trim() ?? "";
  } catch (e) {
    const msg = (e as Error).message ?? "";
    if (useJsonMode && /response_format|json|unsupported/i.test(msg)) {
      jsonModeSupported = false;
      return createCompletion(messages, base, false);
    }
    throw e;
  }
}

export async function callGrokText(
  system: string,
  user: string,
  opts: GrokOpts = {},
): Promise<string> {
  const cfg = getXaiConfig();
  return createCompletion(
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
  );
}

/** Pull the first balanced JSON object out of a model response (handles stray
 *  prose or code fences that slip past json mode). */
function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

export async function callGrokJSON<T>(
  system: string,
  user: string,
  schema: ZodType<T>,
  opts: GrokOpts = {},
): Promise<T> {
  const cfg = getXaiConfig();
  const base = {
    model: opts.model ?? cfg.model,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 1500,
  };
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        system +
        "\n\nRespond with ONLY a single valid JSON object matching the requested schema. No prose, no markdown, no code fences.",
    },
    { role: "user", content: user },
  ];

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const content = await createCompletion(messages, base, jsonModeSupported);
    try {
      return schema.parse(JSON.parse(extractJson(content)));
    } catch (e) {
      lastErr = e;
      messages.push({ role: "assistant", content });
      messages.push({
        role: "user",
        content: `That response did not match the required schema (${(e as Error).message}). Return ONLY corrected JSON, nothing else.`,
      });
    }
  }
  throw new Error(`Grok JSON did not validate after retry: ${(lastErr as Error)?.message ?? lastErr}`);
}
