import type { MealDraftItem } from "../meal/photo-extract";
import { FOOD_MAX_LENGTH } from "../pal/schemas";

export type PhotoDraftResult =
  | { kind: "draft"; dish: string | null; items: MealDraftItem[] }
  | { kind: "upsell"; message: string }
  | { kind: "error"; message: string };

const GENERIC_ERROR =
  "The photo didn't come through this time. You can retake it, or just type or dictate the meal instead.";

/**
 * What composeDraft produced, so the review card can be HONEST about any
 * detail the cap forced it to drop (plan §P1.5: "never silently change meal
 * meaning"). `keptItems < totalItems` means whole components were dropped —
 * a meaning change the user must see before they confirm. `portionsDropped`
 * is the milder degrade where every component name survives but exact amounts
 * were shed.
 */
export type ComposedDraft = {
  text: string;
  totalItems: number;
  keptItems: number;
  portionsDropped: boolean;
};

export function composeDraft(
  dish: string | null,
  items: MealDraftItem[]
): ComposedDraft {
  // The composed text is submitted to /api/check, whose schema caps food at
  // FOOD_MAX_LENGTH — a detailed vision draft over the cap turned into a
  // fail-closed retry card for a user who just confirmed the app's own draft
  // (found by the 2026-07-17 Tier-1 photo run, case p-home-bacon-cheeseburger).
  // Degrade detail in order: full portions -> names only -> fewer items, so
  // glycemic drivers (component names) outlive exact counts.
  const total = items.length;
  const compose = (list: string) =>
    dish && list ? `${dish}: ${list}` : (dish ?? list);

  const withPortions = compose(
    items
      .map((item) => (item.portion ? `${item.name} (${item.portion})` : item.name))
      .join(", ")
  );
  if (withPortions.length <= FOOD_MAX_LENGTH) {
    return {
      text: withPortions,
      totalItems: total,
      keptItems: total,
      portionsDropped: false
    };
  }

  const names = items.map((item) => item.name);
  for (let keep = names.length; keep >= 1; keep -= 1) {
    const candidate = compose(names.slice(0, keep).join(", "));
    if (candidate.length <= FOOD_MAX_LENGTH) {
      return {
        text: candidate,
        totalItems: total,
        keptItems: keep,
        portionsDropped: true
      };
    }
  }
  return {
    text: compose("").slice(0, FOOD_MAX_LENGTH),
    totalItems: total,
    keptItems: 0,
    portionsDropped: total > 0
  };
}

export function composeDraftText(
  dish: string | null,
  items: MealDraftItem[]
): string {
  return composeDraft(dish, items).text;
}

/**
 * Collapse exact-duplicate items the vision drafter sometimes emits (the same
 * component listed twice), so the review chips and the composed text do not
 * repeat a food — which would both confuse the eater and waste the length cap.
 * Case-insensitive on name+portion; first occurrence wins. Returns how many
 * were collapsed so the card can say so out loud.
 */
export function dedupeDraftItems(items: MealDraftItem[]): {
  items: MealDraftItem[];
  collapsed: number;
} {
  const seen = new Set<string>();
  const deduped: MealDraftItem[] = [];
  for (const item of items) {
    const key = `${item.name.trim().toLowerCase()}|${(item.portion ?? "").trim().toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }
  return { items: deduped, collapsed: items.length - deduped.length };
}

export async function requestPhotoDraft(
  imageDataUrl: string
): Promise<PhotoDraftResult> {
  let response: Response;
  try {
    response = await fetch("/api/check/photo-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageDataUrl }),
      signal: AbortSignal.timeout(30_000)
    });
  } catch {
    return { kind: "error", message: GENERIC_ERROR };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { kind: "error", message: GENERIC_ERROR };
  }
  const body = (payload ?? {}) as Record<string, unknown>;

  if (response.status === 402 && typeof body.message === "string") {
    return { kind: "upsell", message: body.message };
  }
  if (response.ok && body.kind === "draft" && Array.isArray(body.items)) {
    return {
      kind: "draft",
      dish: typeof body.dish === "string" ? body.dish : null,
      items: (body.items as MealDraftItem[]).filter(
        (item) => typeof item?.name === "string"
      )
    };
  }
  return {
    kind: "error",
    message: typeof body.message === "string" ? body.message : GENERIC_ERROR
  };
}
