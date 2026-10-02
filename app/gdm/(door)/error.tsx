"use client"; // Error boundaries must be Client Components.

// G-15: the door's error boundary, so a database hiccup never shows an anxious
// user Next's raw error page. It wraps every page under app/gdm/(door) (not
// the (door) nav or the frame in app/gdm/layout.tsx, which stay around it).
//
// R43: it lives here, not at app/gdm/error.tsx. A client boundary that imports
// the bank puts the whole bank in a chunk every page under its segment loads;
// at app/gdm that was the landing too, so a landing-only build shipped the
// organiser's Pending rows in public JS. The door pages exist only under
// `organiser`.
//
// R45: the component itself lives in components/gdm/error-boundary.tsx and is
// re-exported here so this file and app/gdm/start/error.tsx (the other page
// with a live database read, outside this route group) share one
// implementation instead of two copies of the same logic.
export { GdmErrorBoundary as default } from "../../../components/gdm/error-boundary";
