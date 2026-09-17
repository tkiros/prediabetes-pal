import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DisclaimerLine } from "../../../../components/disclaimer-line";
import { OrientationList, type OrientationListProps } from "../../../../components/orientation-list";
import { OrientationNote } from "../../../../components/orientation-note";
import { EMPTY_ORIENTATION, OrientationStateSchema } from "../../../../lib/coach/orientation";
import { guideDoorEnabled } from "../../../../lib/guide-door-flag";
import { getDb, schema } from "../../../../lib/server/db";
import { getSessionInfo } from "../../../../lib/server/session";

export const metadata = {
  title: "Your first week — Prediabetes Pal",
  robots: { index: false }
};

/**
 * Where the week lives, on the device or on the account (rulings F-31, A-33).
 * Signed in with no profiles row (A-92) is a guest here: every PATCH would
 * 404, so a Done tap would fail and take itself back on every tap.
 */
async function listProps(): Promise<OrientationListProps> {
  const session = await getSessionInfo();
  if (!session) return { mode: "guest" };
  const [profile] = await getDb()
    .select({ timezone: schema.profiles.timezone, orientation: schema.profiles.orientation })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, session.userId));
  if (!profile) return { mode: "guest" };
  // Review A-24: an unreadable stored value is the empty week.
  const stored = OrientationStateSchema.safeParse(profile.orientation);
  return {
    mode: "signed-in",
    initialState: stored.success ? stored.data : EMPTY_ORIENTATION,
    timezone: profile.timezone,
    // Ruling F-42: same test as Home's `migrate` — the server copy is null.
    migrate: profile.orientation == null
  };
}

/**
 * /learn/first-week — the page that hosts the orientation week (PRD v1.1 §6
 * F-ORIENT, §7.1; Task 3.6). Review A-76's order: the day, today's step, the
 * other six, the note, then the intro. F-REFER's section is not cleared by
 * the safety owner, so it is not here.
 */
export default async function FirstWeekPage() {
  // Ruling F-39: the door is checked before any session read or query — the
  // query names profiles.orientation, which a database without migration
  // 0019 does not have.
  if (!guideDoorEnabled("orient")) notFound();
  const list = await listProps();

  return (
    <div className="app-content--narrow">
      {/* F-42: the key changes when a migration lands, so the refreshed page
          remounts the list from the server's copy instead of its old state. */}
      <OrientationList key={list.mode === "signed-in" && list.migrate ? "migrating" : "settled"} {...list} />

      <OrientationNote />

      <section className="surface-card hero-card">
        <p className="page-copy">
          Seven small steps, one a day. None of them is a diet. Skip any, come
          back to any.
        </p>
        <p className="page-copy">
          An A1C between 5.7% and 6.4% is a signal, not a sentence. It is
          common, it comes with real room to act, and the acting mostly
          happens in ordinary places: your plate, your week, your next
          appointment.
        </p>
      </section>

      <DisclaimerLine />

      <footer className="page-footer">
        <Link href="/home">Home</Link>
        <Link href="/journey">My journey</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </footer>
    </div>
  );
}
