# GDM door — safety-owner gates

The production build reads the table below (`lib/gdm-door-guard.ts`). A food
surface of the GDM door cannot be listed in `NEXT_PUBLIC_GDM_DOOR` in production
until every gate it needs reads `Signed`.

**Only the decider named on a row edits that row's `Status`.** An implementer
never does — not to unblock a build, not on a preview, not "temporarily".
`Signed` means the decider has done the thing in PRD
`PRD/Prediabetes_Pal_GDM_Door_PRD_v1.1.md` §10.2 and recorded where.

| Gate | What it is | Decider | Status | Signed by | Date | Evidence |
|---|---|---|---|---|---|---|
| `S1` | Intended use extended to a GDM profile; Verdict Semantics entry for the three word-states | Safety owner (counsel) | Not started | — | — | — |
| `S2` | `pregnancy` route scoped off for the GDM profile only | Safety owner | Not started | — | — | — |
| `S3` | A reviewer with pregnancy competence (RDN/CDCES) named | Safety owner | Not started | — | — | — |
| `S4` | Ruling on "lighter than your plan says" for readers who may inject insulin, and its precedence under `possible_hypoglycemia` | Safety owner | Not started | — | — | — |

S5 (the three claim classes) has no row here on purpose: a class is enforced
through the ledger — `npm run contract` refuses an `Approved` row whose class is
not in `docs/safety/claims-boundary.md`.
