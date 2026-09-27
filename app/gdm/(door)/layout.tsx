// app/gdm/(door)/layout.tsx — the signed-in door's nav, nothing else. No auth
// logic: every page under this group calls requireGdmDoor() first, because a
// layout does not re-render on navigation and does not stop its children
// rendering (Next docs, 02-guides/authentication.md, "Layouts and auth checks").
// G-28: the one check here is the same BUILD-TIME flag the outer layout reads,
// so with the organiser off a 404 under this group carries no nav.
import type { ReactNode } from "react";

import { GdmNav } from "../../../components/gdm/nav";
import { gdmDoorEnabled } from "../../../lib/gdm-door-flag";

export default function GdmDoorLayout({ children }: Readonly<{ children: ReactNode }>) {
  if (!gdmDoorEnabled("organiser")) return <>{children}</>;
  return (
    <>
      <GdmNav />
      {children}
    </>
  );
}
