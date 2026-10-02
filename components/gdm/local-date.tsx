"use client";

import { formatIsoDate } from "../../lib/client/gdm-date";
import { useHydrated } from "../../lib/client/use-hydrated";

/**
 * Her date in the device's own words (`formatIsoDate`, G-44), once the page
 * has hydrated. The server cannot know her locale, so the server's HTML and
 * the hydrating render both leave it empty and agree; the words arrive on the
 * next client render. A card that first renders on the client (My plan, which
 * loads its plans after the page has hydrated) shows the date at once, so its
 * look is unchanged. Home renders the same card from the server (G-37).
 */
export function LocalDate({ iso }: { iso: string }) {
  const hydrated = useHydrated();
  return hydrated ? formatIsoDate(iso) : null;
}
