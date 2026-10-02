import { NextResponse } from "next/server";

import { gdmDoorEnabled } from "../../../lib/gdm-door-flag";
import { GDM_COPY } from "../../../lib/pal/gdm/copy";
import { GDM_ROUTES } from "../../../lib/pal/gdm/routes";

// R36: a route handler, not a public/ file — a static file would publish the
// working name while the door is dark. 404s under the same condition as the
// layout's generateMetadata() (either GDM surface open); otherwise the door's
// own manifest. Reuses the first door's installed icons (D7 forbids buying
// another) — same three files public/manifest.webmanifest already ships.
export function GET() {
  if (!gdmDoorEnabled("landing") && !gdmDoorEnabled("organiser")) {
    return new NextResponse(null, { status: 404 });
  }
  const { name, short } = GDM_COPY["gdm-door-name"];
  return NextResponse.json({
    name,
    short_name: short,
    start_url: GDM_ROUTES.start,
    scope: "/gdm",
    display: "standalone",
    theme_color: "#0d5f57",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  });
}
