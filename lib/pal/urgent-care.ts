// FIX1 (feature map 2026-09-24 §3.0) / NEW-003: the human-care line for every
// response that answers BEFORE the deterministic clinical router can run — the
// proxy's 429 and 503s, and the client's own rate-limit and pause copy. A user
// describing acute symptoms at that moment would otherwise see only "try
// again". One constant, imported by the proxy and the client alike (no
// imports here: the proxy and client bundles both pull this file in).
export const URGENT_CARE_LINE =
  "If you're feeling unwell right now — shaky, faint, confused, or worse — don't wait for an app: contact your doctor or your local emergency number.";
