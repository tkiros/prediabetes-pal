# Runbook: Marketing assets

How Prediabetes Pal's screenshots, captions, and store imagery get made — and the claims
discipline every one of them inherits. This is the asset side of the launch;
the price-test procedure lives in `docs/runbooks/price-test.md`.

## The outcome principle

Sell the **moment of relief**, never the interface for its own sake. Every asset
should read as: a real kitchen question → a calm, honest answer. A screenshot of
a result card is only worth posting because of the sentence inside it, not the
chrome around it. When in doubt, ask "does this show someone getting unstuck?" —
if it only shows "an app exists," cut it.

The honesty surfaces are the differentiator. The clarify state ("Is this plain or
sweetened?") and the disclaimer footer are features, not fine print — show them
proudly. A product that says "I'm not sure, tell me more" out-sells one that
fakes certainty to a scam-wary 40–60 audience.

## The caption formula

Every caption is:

    [the user's moment] → [Prediabetes Pal's answer]

- "Thought oatmeal was the safe breakfast → here's what Prediabetes Pal actually said."
- "Stared at the fridge wondering what to make → one description, one calm educational read."

The left side is a human moment in plain words. The right side is what Prediabetes Pal
does, in capability language — never an outcome promise.

## Per-surface guidance

**Landing page / `/subscribe`.** These render the *live* components in-product —
never paste a `/demo` capture onto an on-site page. On-site copy is already
audited where it lives.

**Off-site surfaces (Reddit, X, image posts, decks).** Use `/demo` captures.
Regenerate them with `scripts/capture-marketing-shots.mjs` (see below) so the
pixels always match the shipped product. `/demo` renders the real components
with ledger-approved fixtures, so any copy drift fails the claims scan before it
can reach an asset.

**Pantry assets.** The hero conversion asset is the sample report opening on
"Enjoy freely" (the permission-first row) — lead with relief, not with the scary
rows. For the Reddit launch post, the founder's *real* pantry photo (the actual
input) plus the resulting sample rows tells the whole story honestly.

**Store listing (Play / App Store).** A 3–4 shot daily-relationship narrative:
meal description → cautious educational label → the calm daily loop → the
one-time pantry option. The listing must use the intended-use statement and
verdict semantics from `docs/safety/claims-boundary.md`. No asset may connect
Prediabetes Pal use to a disease outcome, even when the user is the grammatical agent.

## Hard bans

Nothing in any asset may contain:

- **Numbers, graphs, or trajectories** — no A1C values, no glycemic numbers, no
  "down X points," no before/after charts, no upward-arrow imagery.
- **Outcome testimonials** — no disease-outcome story, before/after lab result,
  or member result. There is no North-Star carve-out.
- **Fabricated precision** — no invented member counts, ratings, clinical-proof
  language, regulatory-status language, or made-up specifics.
- **Scarcity framing** — no fake countdowns, "only N spots left," or urgency
  pressure. The trust promise is the opposite of Klinio's dark patterns.

If a shot's copy came from `/demo`, it is already clean. If you write *new*
caption text, it must pass the same boundary.

## The ledger rule

**Every caption written for any asset gets a `launch-informational` copy-ledger
row (`docs/safety/copy-ledger.md`) before publication.** No exceptions, no
"it's just a tweet." The row records the exact string, `Status: Approved`,
`Active: Yes`, `Allowed Claim Class: launch-informational`, and evidence rows —
same discipline as `launch-community-post`. Copy pulled verbatim from `/demo`
is already covered by its result/product rows; only genuinely new asset copy
needs a fresh row.

## Regeneration

Assets must never lag the shipped product. Rerun the capture script after any UI
or copy change during the price test:

    npx next dev                             # dev server on :3000
    node scripts/capture-marketing-shots.mjs # → marketing/screenshots/

The script visits `/demo` and screenshots each `[data-shot]` section (demo check
card, SAFE / MODERATE / HIGH results, the clarify state, the Day-1 first-win
block) at both a phone (375×812 @3x) and a store (1080×2340) viewport. It is a
**manual** tool — it never runs in CI or any test suite.

`ponytail:` for a quick day-2 Reddit post, manual 375px devtools screenshots are
fine. This script exists because assets get regenerated every UI iteration
during the price test; if that stops being true, stop rerunning the script — not
the plan.
