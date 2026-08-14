# Owner decision — longitudinal insights stay ON

**Recorded:** 2026-08-14
**Decided by:** authenticated workspace owner
**Supersedes, in part:** `docs/legal/owner-risk-launch-decision-5f6abcb.md`
(2026-07-12), the bullet *"Longitudinal insights stay **OFF**.
`NEXT_PUBLIC_LONGITUDINAL_INSIGHTS` must remain unset."*
**Sibling entry:** `docs/legal/owner-decision-2026-08-14-photo-assist-on.md`,
which closed the identical conflict for the other disabled function the same
day. That entry recorded this one as an explicit open item; this closes it.

This is a **new entry, not a rewrite**. The 2026-07-12 decision stands as the
record of what was decided on that date and on that evidence. Everything it
says about counsel (waived, gate not cleared, owner-risk accepted) is unchanged
and still governs.

## What was actually true before this decision

The prohibition and the deployed system had disagreed since 2026-07-21, and no
gate could see it — every flag guard in this repo tests the *unset* default,
which is still fail-closed and still correct.

| Source | State |
|---|---|
| `docs/legal/owner-risk-launch-decision-5f6abcb.md:48` | insights OFF, flag must remain unset |
| `docs/release/truth-index.md:35` (2026-07-21, C7 session) | `LONGITUDINAL_INSIGHTS_ENABLED=1` set in Vercel production, mirroring the enabled `NEXT_PUBLIC_*` value |
| `docs/release/truth-index.md:118` | `NEXT_PUBLIC_LONGITUDINAL_INSIGHTS` — **ENABLED in production** |
| Live production | `/privacy` renders both flag-gated clauses — see below |

### How the client flag was verified — live, unauthenticated

`app/(app)/privacy/page.tsx:19` reads `longitudinalInsightsEnabled()` and
branches on it at lines 72 and 74. `/privacy` needs no session (200, 38,622
bytes). Fetched from `https://prediabetespal.com/privacy` on 2026-08-14:

| String | Rendered only when | Hits |
|---|---|---|
| `derived pattern summaries` | insights flag `=1` | 2 |
| `personalized pattern summaries` | insights flag `=1` | 2 |
| `optional meal-check photos` | photo flag `=1` | 2 |

Each string appears twice because the RSC flight payload duplicates the
server-rendered HTML — uniform across all three, so it is consistent, not
noise. The photo row is the control: it re-confirms the sibling ruling from an
independent surface.

### ⚠️ The server twin is INFERRED, not verified live

This is deliberately weaker evidence than the photo precedent carried, and it
is recorded as such rather than rounded up.

`next.config.ts:38–60` throws at build time when `VERCEL_ENV === "production"`
and a `NEXT_PUBLIC` flag is `"1"` while its server twin is not. Production is
live with the client flag ON, therefore `LONGITUDINAL_INSIGHTS_ENABLED=1` was
set **when that build ran**. It is read at request time
(`app/api/coach/route.ts:62`), so a later env edit could in principle have
diverged without a rebuild — that is exactly what the runtime kill switch is
*for*.

A runtime probe is impossible: `GET /api/coach` returns 401 at
`app/api/coach/route.ts:29–32`, **before** the flag branch at line 62. No
unauthenticated surface discriminates the server twin. The photo case had one
(`POST /api/check/photo-draft`, 404 when the flag is unset); this function has
none.

⛔ **`vercel env pull` cannot settle this and must not be cited as if it
could.** `vercel env ls production` shows all four flags *present*. Pulling
`--environment=production` returns **empty strings for all four** — including
`PHOTO_INPUT_ENABLED`, which is provably ON. 30 of 89 pulled variables carried
a value; these did not. **An empty pull is not evidence a flag is off**, and
the flags are fail-closed on the exact string `1`. (The local CLI is also five
majors behind: 54.18.1 vs 59.0.0.)

## Decision

**Longitudinal insights are authorized and stay ON.** Production is ratified as
the truth; the 2026-07-12 prohibition on this function is superseded as of this
entry.

The enabling procedure the 2026-07-12 decision required — *"a function-specific
evidence review, an explicit written owner decision, a new reviewed build, and
new deployment proof"* — was **not followed in order**, the same way it was not
for photo-assist. The build and the deployment proof came first (2026-07-21)
and this written decision comes after. Recorded here rather than papered over.

### What this authorizes

- `NEXT_PUBLIC_LONGITUDINAL_INSIGHTS=1` and its server twin
  `LONGITUDINAL_INSIGHTS_ENABLED=1` may be set in production.
- Product and marketing surfaces may describe derived pattern output, **subject
  to the price clause below**, and within the existing claims boundary — this
  entry authorizes the *function*, not any new claim about what the function
  can tell a reader.

### What it does not touch

- The counsel gate. Still not cleared, still owner-risk. No artifact may state
  `COUNSEL GATE: CLEARED`.
- The fail-closed default. `lib/longitudinal-insights-flag.ts` still requires
  exact `1` on both twins; `next.config.ts`'s twin guard still fails any
  production build with a client-on/server-off mismatch. Those guards are
  unchanged and **must not be inverted** — they protect every build that is not
  production.
- The claims boundary. Insight text is still bound by the same postprocess and
  boundary tests as every other generated string.

## The advertising constraint, and what happens to it

The 2026-07-12 clause read *"No advertising or paid promise may imply that
either disabled function is available."* With this entry, **neither function is
disabled any more**, so the clause has no remaining referent. It is spent, not
repealed — it still correctly describes the rule that applied while either
function was off, and it binds again the moment one is turned back off.

**The price direction is the opposite of photo-assist's.** The photo draft is
Premium; the insight is **free**. `app/api/coach/route.ts` nulls `view.insight`
on the server flag alone (line 62) and applies `capabilitiesFor(entitlement)`
only to the BAI/progress payload below it (line 71) — so any signed-in user
gets the insight, on any tier. `docs/release/truth-index.md:87` (C4) records
the same disposition: thin longitudinal insight is free onboarding value, and
the false "weekly insights are Premium" bullet was removed.

⛔ So the risk to watch here is a surface that describes the insight as
**Premium**, not one that describes it at all.

### Landing exposure, swept 2026-08-14

- `app/page.tsx`, the `includes` entry titled **"Learn your patterns."** — the
  includes-carousel panel. (Cited by title, not line: it sits at 426 on this
  branch and 441 once the line-art PR lands.)
  Body: *"A history of what you actually ate, so the meals that keep coming
  back and the easiest changes to them are visible without logging anything."*
  It promises a history the reader browses, illustrated by the real `/meals`
  list screen, and does not price it. Compatible with this entry either way.
- `docs/release/truth-index.md:88` (C5) cites flag-gated *"weekly pattern"*
  phrasing at `app/page.tsx:315`. **That copy no longer exists** — the landing
  was rebuilt (PR #114) and no `weekly pattern` string survives. C5 should be
  closed against this entry rather than left pending a flag-on that has now
  happened.

No other landing surface implies derived longitudinal insight.

⛔ Turning the flag back off is not a config change on its own. Re-check every
committed screenshot in `public/landing/` before doing it — the photo lesson
applies verbatim: a committed image is invisible to every copy, claims and
rename guard in this repo.

## Documents reconciled with this decision

- `docs/legal/owner-risk-launch-decision-5f6abcb.md` — the 2026-07-12 bullet
  gains a superseded pointer; its text is unchanged
- `docs/legal/counsel-brief.md` — longitudinal row, the now-historical
  "disabled pending" heading, the retained-questions item that called both
  functions dormant, and the gate record. ⚠️ The gate record spells out that of
  the two conditions the 2026-07-12 decision set — a function-specific evidence
  review **and** an explicit written owner decision — only the second exists.
  No evidence-review artifact was produced for either function. Do not let a
  later edit round that up.
- `docs/ops/env-reference.md` — `NEXT_PUBLIC_LONGITUDINAL_INSIGHTS`,
  `LONGITUDINAL_INSIGHTS_ENABLED`
- `docs/ops/launch-checklist.md` — the flag-remains-unset checkbox, **split in
  two**: the client flag ticks (verified live), the server twin stays unticked
  because it never was
- `docs/handoff/human-actions-required.md` — the keep-unset line
- `docs/release/truth-index.md` — the `NEXT_PUBLIC_LONGITUDINAL_INSIGHTS` row

**Not** reconciled, deliberately: `docs/legal/counsel-packet/5f6abcb/**` and
`docs/legal/counsel-panel-review-2026-07-12.md`. Those are the evidence packet
for a specific dated candidate. A packet that described a system it did not
describe would be worthless as a record. Same call as the photo entry.
