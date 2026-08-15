"use client";

import { useRef, useState, type ReactNode } from "react";

/**
 * The landing's "What does Prediabetes Pal include?" tabs.
 *
 * ⚖️ OWNER RULING 2026-08-11 — "when one feature gets clicked it shows them a
 * different image", per `revora_landing_page(1).html`. That file drives the
 * same interaction from `useState`, which is why this is the page's second
 * client component (`landing-pause.tsx` is the first): `app/page.tsx` is a
 * server component and cannot hold selection state.
 *
 * ⛔ THE PANELS ARE PASSED IN, NOT BUILT HERE. They arrive as `ReactNode`s from
 * the server component so the product's own `ExampleResultCard` stays
 * server-rendered — importing it into a "use client" module would drag the
 * whole card recipe into the client bundle to render markup that never
 * changes. This component owns one number and nothing else.
 *
 * ⛔ ONE ARRAY OF PAIRS, NOT TWO PARALLEL ARRAYS. Until 2026-08-15 this took
 * `features` and `panels` separately, with nothing tying entry N of one to
 * entry N of the other. A sixth feature added without a sixth panel produced a
 * tab whose `aria-controls` pointed at no element and an empty art column, and
 * every gate stayed green — the tabs are generated, so no reviewer sees the
 * mismatch either. Pairing them in one object makes that unrepresentable.
 *
 * ⛔ WHAT THE DESIGN FILE DOES AND THIS DOES NOT: its `AppMockup` draws five
 * invented phone screens with invented product output — "Excellent balance of
 * lean protein, complex carbs, and fiber. Enjoy your meal!" and "may cause a
 * rapid spike". Neither is a string this engine produces, and the second is a
 * glycemic claim that fails `claims-boundary-copy.test.ts` on sight. The
 * interaction is the design's; the contents are the product's.
 *
 * ⛔ NO DOT ROW. The design draws dots BELOW the panel as well as the five
 * cards beside it — two controls for one piece of state, both always visible.
 * The cards are the navigation; the dots would be a second tab list saying the
 * same thing to a screen reader.
 *
 * a11y: a real tab list. `aria-selected` carries the state, the panel is
 * labelled by its tab, and Left/Right/Home/End move between tabs with roving
 * tabindex — the WAI-ARIA pattern, because five buttons that all look
 * clickable and only respond to Tab is the failure mode axe cannot see.
 */
export function LandingIncludes({
  items
}: {
  items: ReadonlyArray<{
    title: string;
    lede: string;
    body: string;
    panel: ReactNode;
  }>;
}) {
  const [active, setActive] = useState(0);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const last = items.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = active === last ? 0 : active + 1;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = active === 0 ? last : active - 1;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = last;
    }
    if (next === null) return;
    // Without this the page scrolls under the arrow key as well as moving the
    // selection, which reads as the block jumping away from the reader.
    event.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  }

  return (
    <div className="landing-includes-grid">
      <div className="landing-includes-copy">
        <div
          className="landing-includes"
          role="tablist"
          aria-label="What Prediabetes Pal includes"
          aria-orientation="vertical"
        >
          {items.map((feature, i) => {
            const selected = i === active;
            return (
              <button
                key={feature.title}
                type="button"
                role="tab"
                id={`includes-tab-${i}`}
                aria-selected={selected}
                aria-controls={`includes-panel-${i}`}
                // Roving tabindex: one stop for the whole group, then arrows.
                tabIndex={selected ? 0 : -1}
                ref={(node) => {
                  tabs.current[i] = node;
                }}
                onClick={() => setActive(i)}
                onKeyDown={onKeyDown}
                className="landing-includes-tab"
                data-selected={selected ? "true" : undefined}
              >
                <span className="landing-includes-title">{feature.title}</span>
                <span className="landing-includes-lede">{feature.lede}</span>
                {/* Rendered always, revealed by CSS on the selected tab. Kept
                    in the DOM rather than conditionally mounted so the body is
                    part of the tab's accessible name for every tab, not only
                    the open one — a screen-reader user choosing between five
                    tabs should not have to open each to find out what it is. */}
                <span className="landing-includes-body">
                  {/* ⛔ The inner span is load-bearing, not markup noise. The
                      collapse is `grid-template-rows: 0fr -> 1fr`, and a grid
                      row only collapses if its item can shrink — which needs
                      `min-height: 0` on a CHILD ELEMENT. With bare text here
                      the rule had nothing to match and every unselected tab
                      kept its body's full height as blank space. */}
                  <span>{feature.body}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="landing-includes-art">
        {items.map(({ title, panel }, i) => (
          <div
            key={title}
            role="tabpanel"
            id={`includes-panel-${i}`}
            aria-labelledby={`includes-tab-${i}`}
            // ⛔ FOCUSABLE, per the same WAI-ARIA pattern the tab list above
            // follows. Panels 4 and 5 are prose with nothing focusable inside
            // them, so without this a keyboard reader arrowing to those tabs
            // has no way to reach the content the tab just selected — Tab
            // jumps straight past the panel to the section's exit. axe cannot
            // see it: it only ever inspects the one panel that is not hidden.
            tabIndex={0}
            hidden={i !== active}
          >
            {panel}
          </div>
        ))}
      </div>
    </div>
  );
}
