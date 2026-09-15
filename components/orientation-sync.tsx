"use client";

import { useEffect } from "react";

import { syncOrientation } from "../lib/client/remote-orientation";

/**
 * Signed-in Home's orientation writes, after paint (review A-66): the
 * guest → signed-in migration, then the week's start stamp. Renders nothing;
 * the server page mounts it only with the `orient` door open.
 */
export function OrientationSync({ migrate, start }: { migrate: boolean; start: boolean }) {
  useEffect(() => {
    if (migrate || start) void syncOrientation({ migrate, start });
  }, [migrate, start]);

  return null;
}
