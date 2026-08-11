import {
  createCipheriv,
  createDecipheriv,
  randomBytes
} from "node:crypto";

import { captureServerError } from "../pal/sentry-capture";

/**
 * Column-level encryption for special-category fields (exact A1C, food text)
 * — GDPR Art. 9 posture per docs/adr/stack.md. AES-256-GCM with a fresh IV
 * per value.
 *
 * Payload formats (N-26):
 *   legacy — base64(iv || authTag || ciphertext)              [pre-rotation rows]
 *   v<n>:  — "v1:" + base64(iv || authTag || ciphertext)      [everything new]
 *
 * The version marker is TEXTUAL, not a leading binary byte, on purpose. A
 * legacy payload starts with a random IV, so a binary version byte is
 * indistinguishable from an IV that happens to begin with the same value:
 * ~1 in 256 legacy rows would be mis-parsed, fail the auth tag, and be
 * reported as *tampering*. Base64 cannot contain ':', so the text prefix
 * separates the two formats with zero ambiguity.
 *
 * Rotation (the whole point of the version): HEALTH_DATA_KEY is the primary
 * key and the only one that ever encrypts. Retired keys stay in
 * HEALTH_DATA_KEYS_OLD so their rows keep decrypting. INVARIANT: never drop a
 * key from the keyring while rows encrypted under it exist — a legacy row
 * whose key is gone is indistinguishable from a tampered one, and this module
 * deliberately errs toward calling that tampering (loud) rather than data loss
 * (quiet).
 *
 * ponytail: env-key AES-GCM via node:crypto; upgrade path = KMS/managed keys
 * if compliance posture demands.
 */

const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const DEFAULT_VERSION = 1;
const VERSIONED = /^v(\d+):(.*)$/s;

/** What went wrong, so callers can tell rotation loss from an attack. */
export type DecryptFailure =
  /** Ciphertext (or tag, or IV) does not authenticate under a key we hold. */
  | "tampered"
  /** Payload declares a key version that is not in the keyring — rotation loss. */
  | "unknown_key"
  /** Not a well-formed payload at all (too short / not base64). */
  | "malformed";

export class DecryptError extends Error {
  readonly reason: DecryptFailure;

  constructor(reason: DecryptFailure, message: string) {
    super(message);
    this.name = "DecryptError";
    this.reason = reason;
  }
}

function parseKey(raw: string, label: string): Buffer {
  const key = Buffer.from(raw.trim(), "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(`${label} must be 32 bytes, base64-encoded.`);
  }
  return key;
}

type Keyring = {
  primary: { version: number; key: Buffer };
  /** version -> key, including the primary. Decrypt-only for the rest. */
  byVersion: Map<number, Buffer>;
};

/**
 * Built per call (env is read fresh; these are cheap Buffer ops and tests
 * swap keys between assertions).
 *
 * HEALTH_DATA_KEY          — primary, base64, 32 bytes. Required.
 * HEALTH_DATA_KEY_VERSION  — integer stamped into new payloads. Default 1.
 * HEALTH_DATA_KEYS_OLD     — retired decrypt-only keys: "1:base64,2:base64".
 */
function loadKeyring(): Keyring {
  const raw = process.env.HEALTH_DATA_KEY;
  if (!raw) {
    throw new Error(
      "HEALTH_DATA_KEY is not set — refusing to handle health data unencrypted."
    );
  }

  const rawVersion = process.env.HEALTH_DATA_KEY_VERSION;
  const version = rawVersion ? Number(rawVersion) : DEFAULT_VERSION;
  if (!Number.isInteger(version) || version < 1) {
    throw new Error("HEALTH_DATA_KEY_VERSION must be a positive integer.");
  }

  const primary = { version, key: parseKey(raw, "HEALTH_DATA_KEY") };
  const byVersion = new Map<number, Buffer>([[version, primary.key]]);

  for (const entry of (process.env.HEALTH_DATA_KEYS_OLD ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)) {
    const separator = entry.indexOf(":");
    const oldVersion = Number(entry.slice(0, separator));
    if (separator < 1 || !Number.isInteger(oldVersion) || oldVersion < 1) {
      throw new Error(
        'HEALTH_DATA_KEYS_OLD entries must look like "1:base64key".'
      );
    }
    // The primary always wins its own version — a retired key can never
    // shadow the key we are actively encrypting with.
    if (!byVersion.has(oldVersion)) {
      byVersion.set(
        oldVersion,
        parseKey(entry.slice(separator + 1), "HEALTH_DATA_KEYS_OLD")
      );
    }
  }

  return { primary, byVersion };
}

export function encryptField(plain: string): string {
  const { primary } = loadKeyring();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", primary.key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final()
  ]);

  const body = Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString(
    "base64"
  );
  return `v${primary.version}:${body}`;
}

function openWithKey(raw: Buffer, key: Buffer): string {
  const iv = raw.subarray(0, IV_LENGTH);
  const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]).toString("utf8");
}

/** Throws a DecryptError whose `reason` distinguishes rotation from tampering. */
export function decryptField(payload: string): string {
  const keyring = loadKeyring();
  const versioned = VERSIONED.exec(payload);
  const body = versioned ? versioned[2] : payload;
  const raw = Buffer.from(body, "base64");

  if (raw.length < IV_LENGTH + TAG_LENGTH) {
    throw new DecryptError(
      "malformed",
      "Encrypted payload is too short to be valid."
    );
  }

  if (versioned) {
    const version = Number(versioned[1]);
    const key = keyring.byVersion.get(version);
    if (!key) {
      // Rotation loss, not an attack: we simply no longer hold this key.
      throw new DecryptError(
        "unknown_key",
        `No key for version ${version} — add it to HEALTH_DATA_KEYS_OLD to read these rows.`
      );
    }
    try {
      return openWithKey(raw, key);
    } catch {
      throw new DecryptError(
        "tampered",
        "Authentication tag failed — the ciphertext was modified."
      );
    }
  }

  // Legacy (pre-versioning) row: we do not know which key wrote it, so try the
  // whole keyring. GCM authenticates, so a wrong key can only fail — never
  // return the wrong plaintext.
  for (const key of keyring.byVersion.values()) {
    try {
      return openWithKey(raw, key);
    } catch {
      continue;
    }
  }
  throw new DecryptError(
    "tampered",
    "Authentication tag failed under every key in the keyring."
  );
}

export const UNREADABLE_PLACEHOLDER = "(unreadable entry)";

/**
 * Read a field that must never take a page down (dashboards, history lists).
 *
 * Splits the two failures the old inline copies of this function conflated:
 * an unreadable row after a key rotation is our own doing and degrades
 * quietly, while a failing auth tag means the stored bytes changed under us —
 * that is either DB corruption or an attacker, and it goes to Sentry loudly.
 *
 * Sync by design (it is called inside .map()); captureServerError never throws
 * or rejects, so firing it without awaiting is safe here.
 */
export function safeDecrypt(payload: string): string {
  try {
    return decryptField(payload);
  } catch (error) {
    if (error instanceof DecryptError && error.reason === "unknown_key") {
      return UNREADABLE_PLACEHOLDER;
    }
    void captureServerError(error, "route");
    return UNREADABLE_PLACEHOLDER;
  }
}
