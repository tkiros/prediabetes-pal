# Revora — Support Playbook (P10)

Response macros for the support inbox. Tone: calm, warm, permission-first —
matches the in-app voice (`docs/product-marketing.md`,
`docs/safety/tone-uncertainty-policy.md`). Every macro below is written to
stay inside `docs/safety/claims-boundary.md` — no medical determinations,
clinical advice, disease outcomes, or North-Star carve-outs.

**Support address:** `support@revora.plus` — the single constant in
`lib/pal/contact.ts`. It is no longer an environment variable; change it
there and every surface moves together.

---

## 1. Escalation ladder + SLA

| Tier | Who | Examples | Target first response |
|------|-----|----------|------------------------|
| 1 — Self-serve macro | Support inbox owner | Refunds, deletion help, billing mismatch, magic-link, nudge, export | < 24h (business days) |
| 2 — Engineering | On-call eng | Suspected bug, data-integrity question, repeated billing failures across users | < 48h, or same-day if user-facing outage |
| 3 — Clinical/Safety | Clinical reviewer + on-call eng | Any medical question, any report of a harmful-seeming result | Medical questions: same macro, immediate (§6). Harmful-guidance reports: escalate exactly as `docs/ops/launch-controls.md` §10.4 (pause first, notify reviewer, do not wait to confirm the pattern) |
| 4 — Legal | Counsel | Regulatory complaint, GDPR/CCPA formal request, threatened legal action | < 72h acknowledgment |

Ownership of Tier 1–2 is a `docs/handoff/human-actions-required.md` §10 open
item ("Support ownership") — this playbook is ready to hand to whoever takes
that role.

---

## 2. Refund requests

Two paths depending on purchase channel — always ask "did you subscribe
through the Play Store or on the website?" first if not stated.

**Macro — Play Billing subscriber:**

> Thanks for reaching out. Since you subscribed through Google Play, the
> fastest first step is Google's refund request flow:
> Play Store → Menu → Payments & subscriptions → find Revora → Report a
> problem. If Google cannot resolve it, reply here and Revora will review the
> request, including any rights required where you live. If you'd
> rather cancel without a refund, you can do that any time from the same
> screen, or from your Revora account page — the cancel button lives there,
> not behind an email. Let us know if Google can't help and we'll look
> further.

**Macro — Stripe (web) subscriber:**

> Thanks for reaching out. You're on web billing. Revora refunds the first
> paid subscription charge when requested within seven calendar days. We also
> refund verified duplicate or unauthorized charges, and any case required by
> law. To cancel any time without contacting us, visit
> your account page and use the cancel button — access continues through
> the period you already paid for. If you're within the refund window
> above, reply here with the email you subscribed under and we'll process
> it. Later renewal charges are normally non-refundable after the paid period
> begins unless the Terms or applicable law says otherwise.

**Note on statutory rights:** never state a policy that would override a
user's statutory refund/cooling-off rights in their jurisdiction (this
playbook defaults to US-only launch per plan §12 — if EU users appear,
route to Tier 4/Legal before promising anything, since EU withdrawal-right
rules differ from the US-only default this macro assumes).

---

## 3. Account deletion help

> You can delete your account and everything Revora stores about you
> yourself, any time: sign in → Account → "Delete account & data" → confirm.
> It's immediate and complete — profile, A1C, your full check history, push
> registrations, and subscription records are all removed, with no
> retention window. If you've lost access to the email you signed up with,
> reply here from that same address (or another address you can prove
> belongs to you) and we'll complete the deletion manually within <SLA —
> default a few business days>. See `https://<domain>/account/delete` for
> the full self-serve flow and details.

If the user asks about data going to third parties before deletion: point
to `/privacy` — Revora never sells or shares personal data (US-only, no
sale/share stance, `docs/handoff/human-actions-required.md` §0).

---

## 4. Billing / entitlement mismatch ("I paid but the app still shows free")

**Tier reminder (support-internal):** free is five checks a day plus the
today view; premium adds unlimited checks, history, progress, and the nudge.
Longitudinal insights are not part of the launch candidate while their
owner/evidence gate is off (consistent with the in-app copy — `components/paywall-card.tsx`,
`components/result-card.tsx`, `docs/ops/play-listing.md`). Worth confirming
which limit the user actually hit before treating it as a mismatch — some
"still shows free" reports are really "I hit the five-checks-a-day limit,"
not an entitlement bug.

**Verify-on-read note (support-internal, not user-facing):** Revora heals
most of these automatically. `lib/server/entitlement.ts`'s `getEntitlement`
re-checks the Play Developer API on every read of a stale row — a missed
webhook (RTDN) is not usually the real cause of a persistent mismatch. Ask
the user to first **reload `/account`** — that alone re-triggers the
verify-on-read check and resolves most transient mismatches within seconds.

**Macro:**

> Sorry about that — this is usually a quick fix. Can you open the app,
> go to your Account page, and pull down to refresh (or fully close and
> reopen the app) once? That re-checks your subscription status directly.
> If it still shows the wrong plan after that, reply with the email on
> your account and roughly when you subscribed, and we'll look at the
> subscription record directly. Please don't purchase a second
> subscription while we sort this out — you won't be charged twice, but we
> want to avoid the extra step of refunding a duplicate.

**Never** manually flip a user's entitlement row for a "just refresh it"
report before confirming the underlying provider (Play/Stripe) subscription
status — the verify-on-read path is the source of truth; a manual edit that
disagrees with it will just be overwritten on the next read.

---

## 5. Medical-question deflection (never answer medical questions)

This is the highest-discipline macro — Revora never answers a medical
question, ever, regardless of how it's phrased, and never implies Revora
(or a person behind it) made a clinical judgment call.

**Macro:**

> That's an important question, and it's exactly the kind of thing your
> doctor or a registered dietitian is best placed to answer — they can see
> your full picture in a way Revora can't. Revora only gives general,
> non-clinical information about individual meals; it isn't able to weigh
> in on your specific medical situation. If it's urgent, please contact
> your doctor or local emergency services rather than waiting on a reply
> here.

Rules for this macro (do not deviate):
- Never restate the user's medical question back with an answer, even a
  hedged one ("well, generally...").
- Never use any Banned Claim Family verb in a support reply (diagnose,
  treat, cure, prevent, guarantee, FDA, or any "reverse/reversal" usage
  outside the one approved North-Star line) — a support agent's email is
  just as much "the company speaking" as in-app copy.
- If the user reports a specific adverse event or seems to be in
  crisis, escalate to Tier 3 immediately per §1 in addition to sending the
  macro — do not let the calm tone read as dismissive of urgency.

---

## 6. Magic-link not arriving

> Sorry it hasn't shown up. A few quick things to check: (1) look in Spam/
> Promotions/Junk — sign-in emails sometimes land there on first send; (2)
> if you use an email alias or a "+" address (like
> yourname+revora@gmail.com), try signing in with the exact address you
> originally used — aliases count as separate addresses; (3) wait a
> minute and request a new link from `/signin` — old links expire and only
> the most recent one works. Still nothing after a few minutes? Reply here
> with the email you're using (no need to share anything else) and we'll
> check delivery on our end.

Support-internal: delivery depends on Resend DNS (SPF/DKIM/DMARC) being
correctly configured for the sending domain
(`docs/handoff/human-actions-required.md` §5) — if multiple users report
this around the same time, escalate to Tier 2/on-call before replying
individually; it may be a domain-level deliverability issue, not a
per-user one.

---

## 7. Nudge (daily reminder) not arriving

> A couple of things worth checking: (1) the reminder needs both an in-app
> opt-in and the device notification permission — open Account and confirm
> the reminder toggle is on, then check your device's notification
> settings for Revora specifically; (2) some phones aggressively battery-
> optimize background apps, which can delay or block web push — look for
> a battery-optimization or "allow background activity" setting for
> Revora/your browser and allow it; (3) after a brief delivery error Revora
> retries later the same day, outside your quiet hours, and stops after a
> small bounded number of attempts. If it's been missing for several days
> in a row after checking the above, reply here and we'll take a look.

Support-internal: never manually re-fire a nudge for a user
(`docs/ops/launch-controls.md` §10, "push misfire" scenario) — the cron
uses a per-attempt lease and skips already-notified users by design. A provider
error can be acknowledgement-ambiguous, so the automatic retry is deliberately
bounded; a manual re-fire adds duplicate risk and bypasses the operational
evidence in the cron result.

---

## 8. Data export / GDPR-style requests

> You can see and delete everything Revora stores about you at any time
> from your Account page — deletion is immediate and complete (see
> `https://<domain>/account/delete`). We don't currently have a separate
> self-serve "download my data" export button; if you'd like a copy of
> your data before deleting it, reply here from the email on your account
> and we'll send a summary of what's on file (A1C value, check history,
> and account metadata) within <SLA>. If you're contacting us under GDPR
> or a similar regional data-protection law, please say so explicitly and
> we'll route this to our data-protection contact.

Support-internal: US-only launch is the pre-decided default
(`docs/production-implementation-plan-2026-07-01.md` §12), so GDPR formal
requests are a Tier 4/Legal escalation, not a Tier-1 close — acknowledge
promptly, then hand off.

---

## Macro maintenance

Any wording change to a macro that touches claims (medical-question
deflection, refund/entitlement framing, or anything mentioning "reversal")
should go through `docs/safety/copy-ledger.md` (the approved-copy source of
truth) the same way in-app copy does — not be edited ad hoc in the inbox
tool.
