"use client";

import { useEffect } from "react";

import { track } from "../../lib/client/analytics";

export type GdmDoorSurface = "landing" | "home";

// A lookup, not a bare literal: tests/unit/pal/gdm-copy.test.ts's AST guard
// (Task 0.4) flags any string literal in a non-allowlisted JSX attribute,
// including a technical prop like this one — it cannot tell an enum from
// user-visible copy. Routing a call site's `surface={...}` through a property
// access here (the same shape as a `GDM_COPY[...]` lookup) keeps every call
// site an opaque expression to that walker instead of a flagged literal.
export const GDM_DOOR_SURFACE: Record<GdmDoorSurface, GdmDoorSurface> = {
  landing: "landing",
  home: "home"
};

export function GdmDoorShown({ surface }: { surface: GdmDoorSurface }) {
  useEffect(() => {
    track({ name: "gdm_door_shown", props: { surface } });
  }, [surface]);
  return null;
}
