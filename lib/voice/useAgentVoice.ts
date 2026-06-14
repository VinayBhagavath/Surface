"use client";

// The agent's THINKING VOICE.
//
// As the live pipeline streams its Grok-written narration ("I'm checking what's
// known in mice now"), this hook speaks each line aloud in the Grok voice. Audio
// is synthesised server-side by xAI TTS (see app/api/tts) and played here as a
// queued sequence so thoughts never overlap.
//
// It is purely additive and fails silent: if TTS is unavailable (no key, error,
// or autoplay blocked) the spoken layer simply goes quiet — the on-screen
// thought trail and the rest of the run are unaffected. Nothing is pre-recorded.

import * as React from "react";

async function fetchSpeech(text: string, signal: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal,
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size === 0) return null;
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export type AgentVoice = {
  /** Whether the spoken layer is switched on. */
  enabled: boolean;
  /** True while a line is actually being spoken. */
  speaking: boolean;
  /** The text currently being spoken (for a live "speaking…" indicator). */
  speakingText: string | null;
  /** Toggle the whole feature. Turning off stops playback and clears the queue. */
  toggle: () => void;
  /** Queue lines to be spoken in order (no-op while disabled). */
  enqueue: (lines: string[]) => void;
  /** Speak one line immediately, interrupting whatever is playing (manual replay). */
  playNow: (line: string) => void;
  /** Stop any current playback and empty the queue. */
  stop: () => void;
};

export function useAgentVoice(): AgentVoice {
  const [enabled, setEnabled] = React.useState(false);
  const [speaking, setSpeaking] = React.useState(false);
  const [speakingText, setSpeakingText] = React.useState<string | null>(null);

  const queueRef = React.useRef<string[]>([]);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const urlRef = React.useRef<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const playingRef = React.useRef(false);
  const enabledRef = React.useRef(false);
  // The drainer calls itself between lines; we reach it through a ref so the
  // callback never has to reference itself before it is declared.
  const drainRef = React.useRef<() => void>(() => {});

  const cleanupAudio = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      try {
        audio.pause();
      } catch {
        /* no-op */
      }
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  const drain = React.useCallback(async () => {
    if (playingRef.current || !enabledRef.current) return;
    const [next, ...rest] = queueRef.current;
    if (next == null) return;
    queueRef.current = rest;

    playingRef.current = true;
    setSpeaking(true);
    setSpeakingText(next);

    const controller = new AbortController();
    abortRef.current = controller;
    const url = await fetchSpeech(next, controller.signal);

    const finish = (revoke: boolean) => {
      if (revoke && url) URL.revokeObjectURL(url);
      cleanupAudio();
      playingRef.current = false;
      setSpeaking(false);
      setSpeakingText(null);
    };

    // Cancelled / disabled while the audio was being synthesised.
    if (!enabledRef.current || controller.signal.aborted) {
      finish(true);
      return;
    }
    if (!url) {
      // Synthesis failed for this line — skip it, keep the trail moving.
      finish(false);
      drainRef.current();
      return;
    }

    urlRef.current = url;
    const audio = new Audio(url);
    audioRef.current = audio;
    const onEnd = () => {
      finish(false);
      drainRef.current();
    };
    audio.onended = onEnd;
    audio.onerror = onEnd;
    try {
      await audio.play();
    } catch {
      // Autoplay blocked or playback failed — go quiet rather than spamming.
      onEnd();
    }
  }, [cleanupAudio]);

  React.useEffect(() => {
    drainRef.current = () => void drain();
  }, [drain]);

  const stop = React.useCallback(() => {
    queueRef.current = [];
    cleanupAudio();
    playingRef.current = false;
    setSpeaking(false);
    setSpeakingText(null);
  }, [cleanupAudio]);

  const enqueue = React.useCallback((lines: string[]) => {
    if (!enabledRef.current) return;
    const clean = lines.map((l) => l.trim()).filter(Boolean);
    if (clean.length === 0) return;
    queueRef.current = [...queueRef.current, ...clean];
    drainRef.current();
  }, []);

  const playNow = React.useCallback(
    (line: string) => {
      const text = line.trim();
      if (!text) return;
      enabledRef.current = true;
      setEnabled(true);
      // Interrupt anything in flight, then speak this one next.
      cleanupAudio();
      playingRef.current = false;
      queueRef.current = [text];
      drainRef.current();
    },
    [cleanupAudio],
  );

  const toggle = React.useCallback(() => {
    setEnabled((on) => {
      const next = !on;
      enabledRef.current = next;
      if (!next) stop();
      return next;
    });
  }, [stop]);

  React.useEffect(() => () => stop(), [stop]);

  return { enabled, speaking, speakingText, toggle, enqueue, playNow, stop };
}
