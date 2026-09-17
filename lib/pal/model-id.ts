/**
 * The model identity, with no SDK attached. It lives apart from
 * openai-client.ts (which re-exports all three) so next.config.ts can ask
 * "which model will this build call?" for the production door guard (Task
 * 1.11) without loading the OpenAI SDK every time Next reads its config, and
 * so the idea-label eval and that guard strip a provider prefix identically.
 */

export const DEFAULT_PAL_MODEL = "gpt-5.4-mini";

/**
 * The model this process will actually call — for telemetry (W-13/N-18).
 *
 * Telemetry used to record no model at all, so a user reporting a bad answer
 * could not be attributed to the model that produced it. This is the same
 * resolution the client itself does, kept in one place so the stamp cannot
 * drift from the call.
 */
export function activeModelId(input: NodeJS.ProcessEnv = process.env): string {
  // `??` alone is wrong here: a declared-but-empty PAL_MODEL= (a real .env
  // and a real Vercel state) is a string, so it wins the coalesce and every
  // call asks the provider for model "" — a 400 on every request, product and
  // eval alike. Blank means unset.
  //
  return input.PAL_MODEL?.trim() || DEFAULT_PAL_MODEL;
}

/** "openai/gpt-5.4-mini" → "gpt-5.4-mini"; an unprefixed id is unchanged (A-117). */
export function stripProviderPrefix(modelId: string): string {
  const slash = modelId.indexOf("/");
  return slash === -1 ? modelId : modelId.slice(slash + 1);
}
