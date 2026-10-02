import { ImageResponse } from "next/og";

import { gdmDoorEnabled } from "../../lib/gdm-door-flag";
import { GDM_COPY } from "../../lib/pal/gdm/copy";

// R36 (G-30): the link-preview image for this door speaks the working name
// FROM THE BANK — never a literal, and never lib/pal/labels (the root image's
// import, forbidden here by Task 0.5). 404s unless the landing surface is on,
// so a dark door's link never renders a card at all.
//
// `alt`/`size`/`contentType` are the file-convention's OWN static metadata:
// Next merges them into the segment's <head> from this file directly,
// independently of app/gdm/layout.tsx's generateMetadata() — confirmed by a
// real `next build` with the door dark (Task L.1 report): even though
// generateMetadata() correctly returns {}, an un-gated `alt` constant here
// still surfaced "Gestational Diabetes Organiser" in the streamed
// `og:image:alt` metadata for the dark /gdm 404. Gating `alt` the same way
// the function body is gated closes that leak.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = gdmDoorEnabled("landing") ? GDM_COPY["gdm-door-name"].name : "";

export default function GdmOpengraphImage() {
  if (!gdmDoorEnabled("landing")) {
    return new Response(null, { status: 404 });
  }
  const { name } = GDM_COPY["gdm-door-name"];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 72,
          textAlign: "center",
          backgroundColor: "#0d5f57",
          color: "#f8fafc",
          fontFamily: "sans-serif",
          fontSize: 64,
          fontWeight: 700
        }}
      >
        {name}
      </div>
    ),
    size
  );
}
