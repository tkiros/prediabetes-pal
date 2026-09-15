"use client";

import { useEffect, useRef } from "react";

import { syncOrientation } from "../lib/client/remote-orientation";

/**
 * Signed-in Home's orientation writes, after paint (review A-66): the
 * guest → signed-in migration, then the week's start stamp. Renders nothing;
 * the server page mounts it only with the `orient` door open.
 */
export function OrientationSync({ migrate, start }: { migrate: boolean; start: boolean }) {
  // Same guard as GuideIdeas (A-108): StrictMode runs mount effects twice in
  // dev, which would send the migration twice. Once per mount.
  const sentRef = useRef(false);
  useEffect(() => {
    if (sentRef.current || !(migrate || start)) return;
    sentRef.current = true;
    void syncOrientation({ migrate, start });
  }, [migrate, start]);

  return null;
}
