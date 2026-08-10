/**
 * Shared model-transport policy (NEW-001 / WS-2).
 *
 * One place decides where model traffic may go. Three transports consume it:
 * the Prediabetes Pal text engine (lib/pal/openai-client.ts) and the two vision
 * drafters (lib/meal/photo-extract.ts, lib/pantry/extract.ts) — the vision
 * modules deliberately import nothing from lib/pal/, which is why this
 * lives in a neutral module.
 *
 * Production policy: model traffic is direct OpenAI (no base URL) or the
 * decided OpenRouter architecture — an OPENAI_BASE_URL whose host is on the
 * allowlist below. Any other compatible endpoint stays evaluation-only, so
 * health-adjacent prompts and credentials can never drift to an unvalidated
 * host. HTTPS and no-credentials-in-URL are enforced in every environment.
 * Direct OpenAI remains the escape hatch: unsetting OPENAI_BASE_URL reverts
 * the fleet without a redeploy.
 */

export class PalModelConfigurationError extends Error {
  readonly code = "MODEL_CONFIG";

  constructor(message: string) {
    super(message);
    this.name = "PalModelConfigurationError";
  }
}

/** Hosts production model traffic may target besides direct OpenAI. */
export const PRODUCTION_BASE_URL_HOSTS = new Set(["openrouter.ai"]);

export function isProductionModelEnvironment(
  input: NodeJS.ProcessEnv = process.env
): boolean {
  if (input.VERCEL_ENV === "production") {
    return true;
  }
  if (input.VERCEL_ENV === "preview" || input.VERCEL_ENV === "development") {
    return false;
  }
  return input.NODE_ENV === "production";
}

/**
 * Validate and return the configured OPENAI_BASE_URL, or undefined for direct
 * OpenAI. Throws PalModelConfigurationError on any policy violation.
 */
export function resolveTransportBaseUrl(
  input: NodeJS.ProcessEnv = process.env
): string | undefined {
  const baseURL = input.OPENAI_BASE_URL?.trim() || undefined;
  if (!baseURL) {
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(baseURL);
  } catch {
    throw new PalModelConfigurationError(
      "OPENAI_BASE_URL must be an absolute URL."
    );
  }

  const localHttp =
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
  if (parsed.protocol !== "https:" && !localHttp) {
    throw new PalModelConfigurationError(
      "OPENAI_BASE_URL must use HTTPS unless it targets localhost."
    );
  }
  if (parsed.username || parsed.password) {
    throw new PalModelConfigurationError(
      "OPENAI_BASE_URL must not contain credentials."
    );
  }

  if (
    isProductionModelEnvironment(input) &&
    !PRODUCTION_BASE_URL_HOSTS.has(parsed.hostname.toLowerCase())
  ) {
    throw new PalModelConfigurationError(
      "OPENAI_BASE_URL in production must target OpenRouter (openrouter.ai); other compatible hosts are evaluation-only."
    );
  }

  return baseURL;
}

function isOpenRouterBaseUrl(baseURL: string | undefined): boolean {
  if (!baseURL) {
    return false;
  }
  try {
    return new URL(baseURL).hostname.toLowerCase() === "openrouter.ai";
  } catch {
    return false;
  }
}

/**
 * Model-id naming follows the transport: OpenRouter routes by provider prefix
 * ("openai/gpt-5.4-mini"), direct OpenAI rejects one. Enforced at config time
 * so a mismatched pair fails loudly instead of 400ing on every paid call.
 */
export function assertModelIdMatchesTransport(
  model: string,
  baseURL: string | undefined
): void {
  if (!baseURL && model.includes("/")) {
    throw new PalModelConfigurationError(
      "Direct OpenAI model ids must not include a provider prefix."
    );
  }
  if (isOpenRouterBaseUrl(baseURL) && !model.includes("/")) {
    throw new PalModelConfigurationError(
      "OpenRouter model ids must include their provider prefix."
    );
  }
}
