# Owner decision — meal photo-assist stays ON

**Recorded:** 2026-08-14
**Decided by:** authenticated workspace owner
**Supersedes, in part:** `docs/legal/owner-risk-launch-decision-5f6abcb.md`
(2026-07-12), the bullet *"Meal photo-assist stays **OFF**.
`NEXT_PUBLIC_PHOTO_INPUT` must remain unset."*

This is a **new entry, not a rewrite**. The 2026-07-12 decision stands as the
record of what was decided on that date and on that evidence. Everything it
says about counsel (waived, gate not cleared, owner-risk accepted) is unchanged
and still governs.

## What was actually true before this decision

The prohibition and the deployed system had disagreed for roughly three weeks,
and no gate could see it — every flag guard in this repo tests the *unset*
default, which is still fail-closed and still correct.

| Source | State |
|---|---|
| `docs/legal/owner-risk-launch-decision-5f6abcb.md:42` | photo-assist OFF, flag must remain unset |
| `docs/release/truth-index.md:35` (2026-07-21, C7 session) | `PHOTO_INPUT_ENABLED=1` set in Vercel production, mirroring the enabled `NEXT_PUBLIC_*` value |
| `docs/release/truth-index.md:119` | `NEXT_PUBLIC_PHOTO_INPUT` — **ENABLED in production** |
| Live production | `/check` renders the photo control; `POST /api/check/photo-draft` returns **200**, not 404; the photo FAQ renders on the landing page |

## Decision

**Meal photo-assist is authorized and stays ON.** Production is ratified as the
truth; the 2026-07-12 prohibition on this one function is superseded as of this
entry.

The enabling procedure the 2026-07-12 decision required — *"a function-specific
evidence review, an explicit written owner decision, a new reviewed build, and
new deployment proof"* — was **not followed in order**. The build and the
deployment proof came first (2026-07-21) and this written decision comes after.
That is recorded here rather than papered over: the record of *how* this was
enabled is that it was enabled operationally and ratified afterwards.

### What this authorizes

- `NEXT_PUBLIC_PHOTO_INPUT=1` and its server twin `PHOTO_INPUT_ENABLED=1` may
  be set in production.
- Marketing surfaces may show and describe the photo input, **subject to the
  price clause below**.

### What it does not touch

- **Longitudinal insights stay OFF by this record.** The same 2026-07-12 bullet
  covers `NEXT_PUBLIC_LONGITUDINAL_INSIGHTS`, and `truth-index.md:35` shows
  `LONGITUDINAL_INSIGHTS_ENABLED=1` set in production too — so the *identical*
  conflict is open for that function. The owner ruled on photo-assist only. It
  was not widened here. **This is an open item.**
- The counsel gate. Still not cleared, still owner-risk.
- The fail-closed default. `lib/photo-input-flag.ts` still requires exact `1` on
  both twins, and `tests/smoke/photo-check.spec.ts` still asserts that the
  flag-unset candidate 404s before any model call. That guard is unchanged and
  must not be inverted — it protects every build that is not production.

## The advertising constraint that survives

The 2026-07-12 clause *"No advertising or paid promise may imply that either
disabled function is available"* still binds for longitudinal insights, and its
sibling risk now applies to photo-assist in the opposite direction: **the photo
draft is Premium.**

`components/food-check-form.tsx` passes `premium={mode === "trial" && !entitled}`
— in the shipped paywall mode the chip carries a Premium tag and the route 402s
a free session before any camera opens. So a marketing surface may **show** the
photo input, but may not describe it as part of the free checks.

This is why the landing page ships as it does:

- `public/landing/app-check.png` shows all three input chips **including the
  visible Premium tag** on the photo one;
- the includes copy says **two** free input methods, unconditionally;
- the photo FAQ **leads with the price** and branches on `paywallMode()`.

⛔ Turning the flag back off is not a config change on its own —
`app-check.png` would then picture a camera the build does not have. Re-capture
in the same change (`node scripts/capture-landing-art.mjs` against a production
build with the flags unset). A committed screenshot is invisible to every copy,
claims and rename guard in this repo.

## Documents reconciled with this decision

- `docs/legal/counsel-brief.md` — photo-assist row
- `docs/ops/env-reference.md` — `NEXT_PUBLIC_PHOTO_INPUT`, `PHOTO_INPUT_ENABLED`
- `docs/ops/launch-checklist.md` — the flags-remain-unset checkbox
- `docs/handoff/human-actions-required.md` — the keep-unset line

**Not** reconciled, deliberately: `docs/legal/counsel-packet/5f6abcb/**` and
`docs/legal/counsel-panel-review-2026-07-12.md`. Those are the evidence packet
for a specific dated candidate. A packet that described a system it did not
describe would be worthless as a record.
