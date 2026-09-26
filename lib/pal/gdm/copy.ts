/**
 * The GDM door's Tier 1 copy bank (PRD GDM v1.1 §7.4: "Bounded banks, never
 * free generation, for every product-authored string").
 *
 * Keyed by copy-ledger Copy ID; each row is a record of NAMED strings, so a
 * component reads `GDM_COPY["gdm-door-name"].home`, never an index. The row's
 * strings IN DECLARATION ORDER are the ledger's Copy cell:
 * tests/unit/pal/gdm-copy.test.ts asserts the cell equals
 * `Object.values(row).join(" · ")`, so the ledger and the source cannot drift,
 * and that lib/gdm-door-flag.ts lists exactly these rows. Components import
 * from here and carry no literal copy of their own.
 *
 * Every row ships `Pending | Yes`, class `gdm-organiser`. Rules (PRD §8): no
 * sentence about a reading, a dose, a delivery decision, the pregnancy or the
 * baby; no digit; no grading word; nothing framed as a reduction.
 */
export const GDM_COPY = {} as const satisfies Record<string, Record<string, string>>;
