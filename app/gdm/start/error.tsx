"use client"; // Error boundaries must be Client Components.

// R45: R43's move put the door's error boundary at app/gdm/(door)/error.tsx,
// which does not cover app/gdm/start — outside the (door) route group, and
// itself a live database read (gdmDoorState()) via app/gdm/start/page.tsx. A
// database hiccup there fell through to Next's raw error page with no
// boundary at all. This file gives /gdm/start the SAME boundary behaviour by
// re-exporting the shared component (components/gdm/error-boundary.tsx)
// rather than duplicating its logic.
export { GdmErrorBoundary as default } from "../../../components/gdm/error-boundary";
