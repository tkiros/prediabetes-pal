import { GDM_COPY } from "../../lib/pal/gdm/copy";

// G-38: the frame must not print the working name directly above an h1 that
// is the same name. The landing keeps its own h1 (the name IS the headline);
// every other GDM page that wants the name above its own, different heading
// renders this small mark instead — one bank lookup, no literal copy.
export function GdmWordmark() {
  return <p className="gdm-wordmark">{GDM_COPY["gdm-door-name"].name}</p>;
}
