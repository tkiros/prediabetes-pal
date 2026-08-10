/**
 * Choose the first non-empty release identifier.
 *
 * Vercel's Git SHA is the primary production/preview authority. Explicit
 * SENTRY_RELEASE values remain a fallback for non-Vercel deployments and
 * local release drills.
 */
export function resolveSentryRelease(
  ...candidates: Array<string | null | undefined>
): string | undefined {
  for (const candidate of candidates) {
    const release = candidate?.trim();
    if (release) {
      return release;
    }
  }

  return undefined;
}
