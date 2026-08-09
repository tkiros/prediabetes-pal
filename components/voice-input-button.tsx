"use client";

import { useEffect, useRef, useState } from "react";

import {
  type DictationHandle,
  isSpeechRecognitionSupported,
  startDictation
} from "../lib/client/speech";
import { useHydrated } from "../lib/client/use-hydrated";
import { IconMic } from "./icons";

type VoiceInputButtonProps = {
  onTranscript(transcript: string): void;
  disabled?: boolean;
  /** Focuses the food field so the OS keyboard (and its mic key) comes up. */
  onDictateFallback?(): void;
};

/**
 * "Say your meal." — a mic toggle for the food field. Two fallback paths land
 * on the same keyboard-dictation affordance (forensic 2026-07-27 J6 — iOS
 * Safari is the most common device for the 55–65 audience):
 *
 *  1. API absent: the ctor is missing, so render the fallback button
 *     directly.
 *  2. API present but failing: real iOS Safari 14.5+ EXPOSES
 *     webkitSpeechRecognition, so on the device this gap is about, the
 *     miss is usually a runtime error (dictation disabled, permission
 *     declined) — the failed state routes to the same fallback button
 *     instead of a dead-end error line.
 *
 * The fallback button focuses the food field so the OS keyboard (and its mic
 * key, when the user has one) comes up. Same text path, audio still never
 * reaches Prediabetes Pal servers.
 */
export function VoiceInputButton({
  onTranscript,
  disabled,
  onDictateFallback
}: VoiceInputButtonProps) {
  const hydrated = useHydrated();
  const supported = hydrated ? isSpeechRecognitionSupported() : null;
  const [listening, setListening] = useState(false);
  const [failed, setFailed] = useState(false);
  const [fallbackPrompted, setFallbackPrompted] = useState(false);
  const handleRef = useRef<DictationHandle | null>(null);

  useEffect(() => {
    return () => {
      handleRef.current?.stop();
    };
  }, []);

  if (supported === null) {
    return null;
  }

  if ((!supported || failed) && onDictateFallback) {
    return (
      <div className="voice-input">
        <button
          type="button"
          className="voice-input-button method-chip"
          data-testid="voice-dictation-fallback-button"
          disabled={disabled}
          onClick={() => {
            setFallbackPrompted(true);
            onDictateFallback();
          }}
        >
          <IconMic size={20} />
          Dictate
        </button>
        <span
          aria-live="polite"
          className="voice-input-status"
          data-testid="voice-input-status"
        >
          {failed
            ? "Voice input didn't start. If your keyboard shows a mic key, you can dictate with it — or just type your meal."
            : fallbackPrompted
              ? "If your keyboard shows a mic key, tap it to dictate, then review the text before you submit."
              : ""}
        </span>
      </div>
    );
  }

  if (!supported) {
    // ponytail: no fallback callback wired — a button that focuses nothing
    // would be a false affordance, so keep the passive hint.
    return (
      <p className="field-hint" data-testid="voice-dictation-hint">
        You can also use your keyboard&apos;s mic to dictate.
      </p>
    );
  }

  function stopListening() {
    handleRef.current?.stop();
    handleRef.current = null;
    setListening(false);
  }

  function toggle() {
    if (listening) {
      stopListening();
      return;
    }

    setFailed(false);
    const handle = startDictation({
      onTranscript,
      onEnd: () => {
        handleRef.current = null;
        setListening(false);
      },
      onError: () => {
        handleRef.current = null;
        setListening(false);
        setFailed(true);
      }
    });

    if (handle) {
      handleRef.current = handle;
      setListening(true);
    } else {
      setFailed(true);
    }
  }

  return (
    <div className="voice-input">
      <button
        type="button"
        className="voice-input-button method-chip"
        data-testid="voice-input-button"
        data-listening={listening || undefined}
        aria-pressed={listening}
        disabled={disabled}
        onClick={toggle}
      >
        <IconMic size={20} />
        {listening ? "Stop listening" : "Say your meal"}
      </button>
      <span
        aria-live="polite"
        className="voice-input-status"
        data-testid="voice-input-status"
      >
        {listening
          ? "Listening. Speak your meal, then review the text before you submit."
          : failed
            ? "Voice input didn't start. You can type your meal or use your keyboard's mic."
            : ""}
      </span>
    </div>
  );
}
