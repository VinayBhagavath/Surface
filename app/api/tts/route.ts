// Server-side proxy for the agent-thinking VOICE.
//
// The browser POSTs a single line of the agent's live, Grok-written narration
// (e.g. "I'm checking what's known in mice now") and gets back spoken audio. We
// proxy xAI Text-to-Speech (`POST /v1/tts`, grok-voice-think-fast-1.1) so the
// API key never reaches the client (per the xAI browser-playback guidance).
//
// This is additive and degrades gracefully: with no XAI_API_KEY, or on any
// upstream error, we return a non-200 and the UI simply stays silent — the rest
// of the live run is unaffected. No cached/canned audio, ever.

import { NextRequest, NextResponse } from "next/server";
import { getXaiVoiceConfig, hasXai } from "@/lib/env";

export const dynamic = "force-dynamic";

const MAX_CHARS = 900;

/** Strip things that read badly aloud: bracketed source lists, "(sources: …)",
 *  raw URLs, and collapsed whitespace. Never adds words — only removes noise. */
function speakable(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\(sources?:[^)]*\)/gi, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CHARS);
}

export async function POST(req: NextRequest) {
  if (!hasXai()) {
    return NextResponse.json({ error: "voice disabled: no XAI_API_KEY" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const text = speakable(typeof body.text === "string" ? body.text : "");
  if (!text) return NextResponse.json({ error: "no text" }, { status: 400 });

  const cfg = getXaiVoiceConfig();
  let upstream: Response;
  try {
    upstream = await fetch(`${cfg.baseUrl}/tts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        voice_id: cfg.voiceId,
        language: "en",
        model: cfg.model,
        speed: cfg.speed,
        output_format: { codec: "mp3", sample_rate: 24000, bit_rate: 128000 },
      }),
      // Narrations are short; keep the connection from hanging the run.
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return NextResponse.json({ error: "voice upstream unreachable" }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `voice upstream ${upstream.status}` },
      { status: upstream.status === 429 ? 429 : 502 },
    );
  }

  const audio = await upstream.arrayBuffer();
  return new NextResponse(audio, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
