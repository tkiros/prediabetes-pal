import { and, desc, eq } from "drizzle-orm";

import type { GdmItemKind } from "../pal/gdm/items";
import { captureServerError } from "../pal/sentry-capture";
import { UNREADABLE_PLACEHOLDER, safeDecrypt } from "./crypto";
import { schema, type Db } from "./db";

/*
 * SERVER-ONLY: this module decrypts her entries. Import it from route
 * handlers and server pages, never from a client component.
 */

export type GdmItem<T> = { id: string; createdAt: string; updatedAt: string; body: T };
export type GdmUnreadableReport = { kind: GdmItemKind; unreadable: number };

/**
 * Her entries of one kind, newest first, decrypted and parsed. A row that will
 * not decrypt or parse is left out of the list (the account export still
 * carries it, as the placeholder) — but a row left out must reach somebody
 * (G-12): otherwise an entry of hers could vanish, still count toward her cap,
 * and neither she nor the owner would ever know. So the count, with the kind,
 * goes to `report` once per list, and only when it is above zero.
 */
export async function listGdmItems<T>(
  db: Db,
  userId: string,
  kind: GdmItemKind,
  report: (event: GdmUnreadableReport) => void | Promise<void> = reportToSentry
): Promise<Array<GdmItem<T>>> {
  const rows = await db
    .select({
      id: schema.gdmItems.id,
      bodyCiphertext: schema.gdmItems.bodyCiphertext,
      createdAt: schema.gdmItems.createdAt,
      updatedAt: schema.gdmItems.updatedAt
    })
    .from(schema.gdmItems)
    .where(and(eq(schema.gdmItems.userId, userId), eq(schema.gdmItems.kind, kind)))
    .orderBy(desc(schema.gdmItems.createdAt));

  const items: Array<GdmItem<T>> = [];
  let unreadable = 0;
  for (const row of rows) {
    const body = readBody(row.bodyCiphertext);
    if (body === undefined) {
      unreadable += 1;
      continue;
    }
    items.push({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      body: body as T
    });
  }
  if (unreadable > 0) await report({ kind, unreadable });
  return items;
}

/** The parsed body, or undefined when it will not decrypt (safeDecrypt never throws) or parse. */
function readBody(ciphertext: string): unknown {
  const plain = safeDecrypt(ciphertext);
  if (plain === UNREADABLE_PLACEHOLDER) return undefined;
  try {
    return JSON.parse(plain) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * G-12's default: one event through the server's one allowlisted Sentry seam.
 * The scrubber redacts every message, so the kind and the count travel in the
 * two machine-token tags captureServerError builds: `errorClass` from `name`
 * and `errorCode` from `code` ("<kind>.<count>", e.g. "ask.2"). Never an id,
 * never content.
 */
async function reportToSentry({ kind, unreadable }: GdmUnreadableReport): Promise<void> {
  const event = Object.assign(new Error("gdm_items_unreadable"), {
    name: "GdmItemsUnreadable",
    code: `${kind}.${unreadable}`
  });
  await captureServerError(event, "route");
}
