"use client";

import { useEffect } from "react";

import { track } from "../../lib/client/analytics";

export type GdmDoorSurface = "landing" | "home";

// Ruling R38: the AST literal-copy guard (tests/unit/pal/gdm-copy.test.ts)
// exempts a string-initialised attribute on a COMPONENT element (a
// capitalised tag, like this one) when its value is a closed-enum token
// (lowercase, no spaces) — a plain `surface="landing"` reads as a technical
// enum, not user-visible copy. Task L.1's `GDM_DOOR_SURFACE` lookup-object
// indirection existed only to route around the guard before that exemption
// existed; it is reverted here in favor of a direct literal at every call
// site.
export function GdmDoorShown({ surface }: { surface: GdmDoorSurface }) {
  useEffect(() => {
    track({ name: "gdm_door_shown", props: { surface } });
  }, [surface]);
  return null;
}
