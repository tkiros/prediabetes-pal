"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { syncOrientation } from "../lib/client/remote-orientation";

/**
 * Signed-in Home's orientation writes, after paint (review A-66): the
 * guest → signed-in migration, then the week's start stamp. Renders nothing;
 * the server page mounts it only with the `orient` door open.
 *
 * Ruling F-34: once a migration write lands, one router.refresh() re-renders
 * the server page so it shows the migrated day, not the day 1 it rendered from
 * a null server copy. No loop: the refreshed page sees a non-null copy and
 * passes `migrate: false` (unmounting this, or re-rendering it with the ref
 * already set — a refresh keeps client state), and syncOrientation cannot
 * report a migration without `migrate`.
 */
export function OrientationSync({ migrate, start }: { migrate: boolean; start: boolean }) {
  const router = useRouter();
  // Same guard as GuideIdeas (A-108): StrictMode runs mount effects twice in
  // dev, which would send the migration twice. Once per mount.
  const sentRef = useRef(false);
  useEffect(() => {
    if (sentRef.current || !(migrate || start)) return;
    sentRef.current = true;
    void syncOrientation({ migrate, start }).then((migrated) => {
      if (migrated) router.refresh();
    });
  }, [migrate, start, router]);

  return null;
}
