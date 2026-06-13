"use client";

// Browser Web Speech API wrapper (TTS out + STT in). xAI/Grok has NO speech models
// (verified: @ai-sdk/xai exposes only language/image/embedding), so speech I/O is the
// browser's job; Grok powers the follow-up REASONING (see app/actions/ask-followup.ts).
// Everything degrades gracefully: unsupported or erroring → silent no-op, text still works.

import * as React from "react";

type RecognitionResultLike = { transcript: string };
type RecognitionEventLike = { results: ArrayLike<ArrayLike<RecognitionResultLike>> };
type RecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionCtor = new () => RecognitionLike;

function getRecognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

// Stable no-op subscribe for useSyncExternalStore (the capability value never changes).
const noopSubscribe = () => () => {};

export type SpeechApi = {
  ttsSupported: boolean;
  sttSupported: boolean;
  speaking: boolean;
  listening: boolean;
  speak: (text: string) => void;
  cancelSpeech: () => void;
  listen: (onResult: (text: string) => void) => void;
  stopListening: () => void;
};

export function useSpeech(): SpeechApi {
  const [speaking, setSpeaking] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const recRef = React.useRef<RecognitionLike | null>(null);

  // SSR-safe capability detection: getServerSnapshot returns false so the first client
  // render matches the server (no hydration mismatch); the real value applies after hydration.
  const ttsSupported = React.useSyncExternalStore(
    noopSubscribe,
    () => typeof window !== "undefined" && "speechSynthesis" in window,
    () => false,
  );
  const sttSupported = React.useSyncExternalStore(
    noopSubscribe,
    () => getRecognitionCtor() !== undefined,
    () => false,
  );

  const speak = React.useCallback(
    (text: string) => {
      if (!ttsSupported || !text.trim()) return;
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.02;
        u.pitch = 1;
        u.onstart = () => setSpeaking(true);
        u.onend = () => setSpeaking(false);
        u.onerror = () => setSpeaking(false);
        window.speechSynthesis.speak(u);
      } catch {
        setSpeaking(false);
      }
    },
    [ttsSupported],
  );

  const cancelSpeech = React.useCallback(() => {
    if (!ttsSupported) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* no-op */
    }
    setSpeaking(false);
  }, [ttsSupported]);

  const listen = React.useCallback((onResult: (text: string) => void) => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    try {
      const rec = new Ctor();
      rec.lang = "en-US";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.continuous = false;
      rec.onresult = (e) => {
        const t = e.results?.[0]?.[0]?.transcript ?? "";
        if (t) onResult(t);
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      recRef.current = rec;
      setListening(true);
      rec.start();
    } catch {
      setListening(false);
    }
  }, []);

  const stopListening = React.useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* no-op */
    }
    setListening(false);
  }, []);

  React.useEffect(
    () => () => {
      try {
        if (typeof window !== "undefined") window.speechSynthesis?.cancel();
        recRef.current?.stop();
      } catch {
        /* no-op */
      }
    },
    [],
  );

  return {
    ttsSupported,
    sttSupported,
    speaking,
    listening,
    speak,
    cancelSpeech,
    listen,
    stopListening,
  };
}
