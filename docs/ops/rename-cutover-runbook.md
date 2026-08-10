# Rename cutover runbook — Revora → Prediabetes Pal

**Created:** 2026-08-10 · **Branch:** `rename/prediabetes-pal` · **Status:** staged, not cut over

Execution runbook for the rename decided in `docs/naming-decision-shortlist.md`.
The code is committed and green; what remains is DNS, the Resend cutover, and
merge ordering. Read §2 before touching DNS — two records must **not** be edited.

---

## 0. What changed since the 2026-08-09 handoff

Three of that handoff's assumptions turned out to be wrong. They are corrected
here; prefer this file where the two disagree.

| Handoff said | Reality | Consequence |
|---|---|---|
| "The old domain keeps working while the new one verifies — these overlap safely" | **Resend Free allows exactly 1 sending domain.** `contact.revora.plus` occupies it. Verified 2026-08-10: `POST /domains` → `403 Your plan includes 1 domain.` | Overlap is impossible without upgrading to Pro ($20/mo, 10 domains). Owner chose the **hard cutover** instead — see §3. |
| "wait for green" on the Resend domain | The aggregate `status` field is **not** a usable gate. `contact.revora.plus` has been production's sender since 2026-07-21 while reading `partially_failed` — the only failed record is the *optional inbound* MX. | Gate on the **three sending records**, never on `status`. See §3.3. |
| `revora.plus`'s MX is Namecheap forwarding | **`revora.plus` has no MX records at all** (confirmed via 1.1.1.1, 8.8.8.8, 9.9.9.9 on 2026-08-10). | `support@revora.plus` — printed in Terms, Privacy, reports and `security.txt` — is **bouncing today**. Pre-existing defect, not caused by the rename. Do not repeat it on the new domain: §2.4. |

---

## 1. Current state

- `prediabetespal.com` — registered, Namecheap NS, parking A `192.64.119.172`,
  `eforward1-5` MX present, apex SPF `include:spf.efwd.registrar-servers.com`.
- `prediapal.com` — **still unregistered.** Owner chose to skip (2026-08-10).
  The fallback name is unprotected; if Play rejects the name over the
  DiabetesPal conflict, this may no longer be available.
- Vercel — `prediabetespal.com` added to project `revora` (2026-08-10).
  Awaiting the apex A record. Nameservers deliberately left at Namecheap.
- Resend — only `contact.revora.plus` exists. The new domain **cannot** be
  created until the old one is deleted.
- Code — `rename/prediabetes-pal` @ `7840b20`. All gates green.

---

## 2. DNS at Namecheap — publish these now

Advanced DNS on `prediabetespal.com`. Steps 2.1–2.3 are safe to publish
**before** the Resend cutover and shorten the §3 outage window, because two of
the three sending records are predictable and only DKIM has to wait.

### 2.1 Point the apex at Vercel
| Type | Host | Value | TTL |
|---|---|---|---|
| A Record | `@` | `216.198.79.1` | Automatic |

Replaces the parking A `192.64.119.172`. `216.198.79.1` is what `revora.plus`
already uses and is proven in this account — the CLI here is 4 major versions
stale and still prints the older `76.76.21.21`, which also works. Prefer
whatever the Vercel dashboard shows for this project.

### 2.2 `www` parity (optional, matches revora.plus)
| Type | Host | Value | TTL |
|---|---|---|---|
| CNAME | `www` | `cname.vercel-dns.com` | Automatic |

### 2.3 Resend SPF — publish now, ahead of the cutover
| Type | Host | Value | Priority | TTL |
|---|---|---|---|---|
| MX Record | `send.contact` | `feedback-smtp.us-east-1.amazonses.com` | 10 | Automatic |
| TXT Record | `send.contact` | `v=spf1 include:amazonses.com ~all` | — | Automatic |

These are region-derived (`us-east-1`), identical in shape to the verified
records on `contact.revora.plus`, so they can be published before the Resend
domain exists. Doing so leaves **only the DKIM TXT** to add during the outage
window.

### 2.4 ⛔ Do NOT touch
- **The apex TXT** `v=spf1 include:spf.efwd.registrar-servers.com ~all`.
  Resend's SPF lands on `send.contact`, a different name. A second SPF record
  at the apex is a **permerror** that breaks SPF evaluation entirely.
- **The `eforward1-5` MX records on `@`.** They carry `support@`.
- **The nameservers.** Keep `dns1/dns2.registrar-servers.com`. Vercel will
  offer to take over DNS (option (b) in `vercel domains inspect`) — accepting
  it **deletes the eforward MX** and kills `support@` before it ever works.
  That is the most plausible explanation for how `revora.plus` lost its MX.
- **`contact.revora.plus`'s existing records**, until after §3 succeeds.

### 2.5 Prove `support@` actually receives
MX presence is not delivery. Namecheap publishes `eforward` MX when forwarding
is enabled on the domain, but the **per-address rule is separate**. Send a real
message to `support@prediabetespal.com` and confirm it arrives.
`revora.plus` is the proof that "MX looks right" and "mail arrives" are
different claims.

---

## 3. ⛔ The Resend hard cutover — the outage window

**Owner decision, 2026-08-10:** hard cutover, not a $20/mo Pro upgrade.
This knowingly accepts what handoff §3.1 was written to prevent.

**During this window no magic link can be sent, so nobody can sign in or sign
up.** Existing sessions are unaffected.

### 3.1 Before starting
- §2.1–2.3 published and resolving.
- You are **at the Namecheap console**, able to paste a record immediately.
  The window starts at deletion and ends when DKIM verifies — being away from
  the console turns ~15 minutes into hours.
- Prefer a low-traffic hour.

### 3.2 Sequence
1. Delete `contact.revora.plus` from Resend. **Outage starts.**
2. Create `contact.prediabetespal.com`, region `us-east-1`. Returns the DKIM key.
3. Publish immediately at Namecheap:
   | Type | Host | Value |
   |---|---|---|
   | TXT | `resend._domainkey.contact` | *(the `p=MIGf…` key from step 2)* |
4. Trigger verification. The subdomain has never been queried, so there is no
   negative cache to expire — fresh Namecheap records typically resolve in
   minutes, not the 24–48h worst case for *changing* existing records.
5. Confirm §3.3, then send a real magic link to yourself. **Outage ends.**

### 3.3 The actual gate — three records, not `status`
Verified when **all three** report `verified`:
- `DKIM` TXT `resend._domainkey.contact`
- `SPF` MX `send.contact`
- `SPF` TXT `send.contact`

The domain will read **`partially_failed` forever** because the optional
*inbound* MX (`contact` → `inbound-smtp.us-east-1.amazonaws.com`) is not being
configured — we do not want Resend inbound. **This is expected and fine.**
Do not publish an inbound MX just to force the aggregate green.

---

## 4. Merge ordering

`main` ← PR #71 (landing v4) ← `rename/prediabetes-pal`. The rename branches
off #71's HEAD, not `main`, because #71 rewrites the landing the rename edits.
**Merge #71 first.**

Before merging the rename, all of these must hold:

1. §3.3 green and a real magic link received.
2. `prediabetespal.com` resolving to Vercel (§2.1) — required by item 3.
3. **Railway `APP_URL` updated to `https://prediabetespal.com`.**
   `.railway/railway.ts` builds `hourly-crons` from **`main`**, and
   `scripts/run-hourly-crons.mjs` `validateCronConfig()` throws
   `invalid_app_url` unless `env.APP_URL` is byte-equal to the hardcoded
   `CANONICAL_APP_URL`. Merging the rename redeploys the cron with the new
   canonical URL while Railway may still hold `revora.plus` — that mismatch
   kills **all four** hourly jobs: `nudge`, `pantry-sweep`, `trial-precharge`,
   and `stripe-reconcile` (the SLO backstop for missed Stripe webhooks).
   Unlike `NEXT_PUBLIC_APP_URL`, this is **not** a step-4 env flip — it cuts
   over the moment the branch deploys.

After merge:
4. Flip `NEXT_PUBLIC_APP_URL` → `https://prediabetespal.com` in Vercel.
5. 301 `revora.plus` → `prediabetespal.com`. **Keep `revora.plus` registered** —
   it preserves every link already posted in FB groups and DMs.
6. Re-run the marketing capture (landing copy changed).

---

## 5. Open items for the owner

- **`prediapal.com` unregistered** — fallback name unprotected (§1).
- **`support@revora.plus` bounces today** (§0). Still printed in Terms,
  Privacy and `security.txt` until the rename merges.
- **`LEGAL_ENTITY_NAME`** in Vercel still reads `Revora`; it renders in Terms
  and Privacy. Env change, and arguably a legal decision — `env-reference.md:66`
  notes the owner WTP decision authorised the brand name, not an entity.
- **Counsel item N6** — re-approval of the renamed copy-ledger rows,
  including the shortened `high-range-route` (the longer name pushed it past
  the 280-char cap; second mention → "It").
- **Dangling "counsel Q8"** — `PRODUCT.md:23` and `copy-ledger.md:97` gate the
  reversal line on a Q8 that does not exist. Pre-existing. Do not invent one.
- **`revora.bio` listed in Vercel** but RDAP 404s — stale team entry, and the
  `owned-domains` test correctly calls it unowned. Cosmetic.
- **Manifest `short_name`** is now `Prediabetes Pal` (15 chars) and will
  truncate on some Android launchers.
