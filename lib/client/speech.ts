/**
 * Voice input (plan P2 / §6.2): a thin wrapper over the browser Web Speech
 * API. Speech becomes text in the same textarea; the user reviews, edits, and
 * submits their own words through the unchanged /api/check path. Audio is
 * processed by the browser/OS speech service — it never reaches Prediabetes Pal
 * servers. Where the API is unavailable (iOS Safari) callers hide the mic and
 * point to keyboard dictation instead.
 */

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechResultEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  start(): void;
  stop(): void;
};

type SpeechResultEventLike = {
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};

type SpeechHost = {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  navigator?: { language?: string };
};

export type DictationHandle = { stop(): void };

export type DictationCallbacks = {
  onTranscript(transcript: string): void;
  onEnd(): void;
  onError(error: string): void;
};

function getRecognitionCtor(host: SpeechHost) {
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(
  host: SpeechHost = globalThis as SpeechHost
): boolean {
  return getRecognitionCtor(host) !== null;
}

export function startDictation(
  callbacks: DictationCallbacks,
  host: SpeechHost = globalThis as SpeechHost
): DictationHandle | null {
  const Recognition = getRecognitionCtor(host);

  if (!Recognition) {
    return null;
  }

  const recognition = new Recognition();
  recognition.lang = host.navigator?.language ?? "en-US";
  recognition.interimResults = true;
  recognition.continuous = false; // single utterance: silence ends dictation

  recognition.onresult = (event) => {
    const segments: string[] = [];
    for (let i = 0; i < event.results.length; i += 1) {
      segments.push(event.results[i][0].transcript);
    }
    callbacks.onTranscript(segments.join(""));
  };
  recognition.onerror = (event) => {
    callbacks.onError(event.error ?? "unknown");
  };
  recognition.onend = () => {
    callbacks.onEnd();
  };

  recognition.start();

  return { stop: () => recognition.stop() };
}
