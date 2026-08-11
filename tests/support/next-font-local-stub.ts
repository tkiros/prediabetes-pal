// next/font/local is a build-time Next transform; in vitest its export is not
// callable, so any component importing app/fonts.ts (the landing does, for the
// FINDING-030 className protection) would throw on render. Alias it to a
// stand-in with DISTINGUISHABLE class markers — an empty-string stub would let
// "font class deleted" render identically to "font class applied", masking the
// exact wiring these classes exist to guarantee. landing-wiring-pins.test.ts
// asserts the markers land on <body> and the landing root.
//
// Replaced the next/font/google stub on 2026-08-10 when the fonts were
// self-hosted. The markers are deliberately UNCHANGED (`__stub_plus_jakarta_sans`,
// `__stub_source_sans_3`) so every existing assertion keeps its meaning — the
// delivery mechanism moved, the wiring contract did not.
//
// The marker is derived from `src` rather than passed in, because next/font/local
// takes one options object: keying off the filename is what keeps the two
// families distinguishable without the call sites knowing about this stub.
const MARKERS: Array<[RegExp, string]> = [
  [/PlusJakartaSans/i, "plus_jakarta_sans"],
  [/SourceSans3/i, "source_sans_3"]
];

type LocalFontOptions = {
  src: string | Array<{ path: string }>;
  variable?: string;
  [key: string]: unknown;
};

export default function localFont(options: LocalFontOptions) {
  const src =
    typeof options.src === "string" ? options.src : (options.src?.[0]?.path ?? "");
  const marker = MARKERS.find(([re]) => re.test(src))?.[1];

  if (!marker) {
    // Loud, not silent: a new font file with no marker would otherwise render
    // as a blank className and quietly defeat the FINDING-030 assertions.
    throw new Error(
      `next-font-local-stub: no marker for src "${src}". Add one to MARKERS so the ` +
        `FINDING-030 className assertions can still tell the faces apart.`
    );
  }

  return {
    className: `__stub_${marker}`,
    variable: `__stub_${marker}_var`,
    style: { fontFamily: marker }
  };
}
