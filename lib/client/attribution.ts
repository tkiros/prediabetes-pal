// §0.2 #6 — acquisition attribution. Closed enum end to end: the raw
// utm_source string is mapped onto CHANNELS at capture time and ONLY the
// mapped value is ever stored or sent, so the analytics no-free-text contract
// (lib/client/analytics.ts) holds by construction. NOTE: this event is the
// ONLY channel read — PR-6's data-exclude-search (app/layout.tsx) strips
// query strings client-side before they reach Umami, so the dashboard has no
// native UTM/query capture at all.

export const CHANNELS = [
  "reddit",
  "video",
  "facebook",
  "search",
  "friend",
  "other"
] as const;

export type Channel = (typeof CHANNELS)[number];

const STORAGE_KEY = "pal.utm.v1";

// Order matters: first match wins. Patterns cover the strategy's three
// channels (Reddit, short-form video, Facebook groups) plus the organic pair.
const UTM_PATTERNS: ReadonlyArray<[RegExp, Channel]> = [
  [/reddit/, "reddit"],
  [/tiktok|reels?|shorts?|youtube|\byt\b|instagram|\big\b|video/, "video"],
  [/facebook|\bfb\b|meta/, "facebook"],
  [/google|bing|duckduckgo|search|seo/, "search"],
  [/friend|referral/, "friend"]
];

export function mapUtmSource(raw: string | null | undefined): Channel | "none" {
  if (!raw) {
    return "none";
  }
  const source = raw.toLowerCase();
  for (const [pattern, channel] of UTM_PATTERNS) {
    if (pattern.test(source)) {
      return channel;
    }
  }
  return "other";
}

/**
 * First-touch capture: store the mapped channel once, on the first page that
 * arrives with a utm_source. Later visits (including UTM-less direct opens)
 * never overwrite it — first touch is the read the decision rules want.
 */
export function captureFirstTouchUtm(
  search: string,
  storage: Pick<Storage, "getItem" | "setItem"> | null = safeStorage()
): void {
  if (!storage) {
    return;
  }
  try {
    if (storage.getItem(STORAGE_KEY) !== null) {
      return;
    }
    const source = new URLSearchParams(search).get("utm_source");
    const mapped = mapUtmSource(source);
    if (mapped !== "none") {
      storage.setItem(STORAGE_KEY, mapped);
    }
  } catch {
    // storage unavailable — attribution is best-effort, never blocking
  }
}

/** The stored first-touch channel, validated back onto the closed enum. */
export function storedUtmChannel(
  storage: Pick<Storage, "getItem"> | null = safeStorage()
): Channel | "none" {
  if (!storage) {
    return "none";
  }
  try {
    const stored = storage.getItem(STORAGE_KEY);
    return stored !== null && (CHANNELS as readonly string[]).includes(stored)
      ? (stored as Channel)
      : "none";
  } catch {
    return "none";
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
