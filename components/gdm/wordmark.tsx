import Link from "next/link";

import { GDM_COPY } from "../../lib/pal/gdm/copy";

// G-38: the frame must not print the working name directly above an h1 that
// is the same name. The landing keeps its own h1 (the name IS the headline);
// every other GDM page that wants the name above its own, different heading
// renders this small mark instead — one bank lookup, no literal copy.
//
// G-34: in the door's nav the mark is the Home link (`href`); start and the
// privacy notice render it plain, as a paragraph.
export function GdmWordmark({ href, current = false }: { href?: string; current?: boolean }) {
  const name = GDM_COPY["gdm-door-name"].name;
  if (!href) return <p className="gdm-wordmark">{name}</p>;
  return (
    <Link className="gdm-wordmark gdm-wordmark-link" href={href} aria-current={current ? "page" : undefined}>
      {name}
    </Link>
  );
}
