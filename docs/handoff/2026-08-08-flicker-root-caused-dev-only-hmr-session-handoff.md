# Flicker defect **STILL OPEN** · two fixes attempted, neither confirmed · session handoff

> # ⛔⛔ READ §11 FIRST. IT OVERRIDES EVERY "FIXED" AND "ROOT-CAUSED" CLAIM BELOW.
>
> The defect is **NOT FIXED**. The owner reported it persisting after the §10 fix,
> and the dev log confirms the loop was still running afterwards. This file was
> written in three passes as my understanding changed, and the headers below are
> from passes that turned out to be wrong. Trust §11.
>
> - §1–§4 blamed the owner's **browser extensions**. **Wrong** — they are innocent.
> - §10 blamed a **stale service worker** and declared it fixed. **The fix could not
>   possibly have run** (React effect on a page that never hydrates), and the cause
>   itself is still unconfirmed.
> - §11 has the honest status and the one decisive test to run next.
>
> **Still solid across all three passes:** the CSS is exonerated (§2), production is
> clean (§10.4), and the bug is client-side *state* in the owner's normal Firefox
> profile — clean profile fine, private window fine, normal window broken.

---

> ## 🔴 (superseded pass 2) — the service worker hypothesis, kept for its evidence
>
> **Root cause:** a service worker registered on `http://localhost:3000` by an
> earlier **production** build stays active forever and controls the **dev** server,
> because dev and `next start` share one origin. It reload-loops the dev page. That
> loop is the flicker.
>
> **Proof (owner's DevTools, `simplescreenrecorder-2026-08-08_08.12.16.mkv`):**
> ```
> ⊘ GET [turbopack]…hmr-client…0tsedey._.js   NS_BINDING_ABORTED
> ⊘ GET [turbopack]…hmr-client…1mojsay._.js   NS_BINDING_ABORTED
> 200 GET /   document   html   ← Transferred: "service worker"
> ```
> Plus the decisive owner observation: **"it works fine in incognito."** Service
> workers do not run in Firefox private windows.
>
> **Our own code already described this bug** — `components/sw-register.tsx:16-21`
> calls it "an unbreakable ~5 reloads/second loop that reads as the whole page
> flickering." A guard was added that *declines to register* in dev. It was not
> enough: **nothing tore down a registration that already existed.**
>
> **Fix:** `components/sw-register.tsx` now actively unregisters in dev (§10).
> Regression test: `tests/unit/revora/sw-dev-teardown.test.ts` — verified to fail
> without the fix.
>
> **What §1–§4 got right:** the reload loop and its symptom mapping, that it is
> dev-only, and that the CSS is innocent. **What they got wrong:** blaming the
> owner's extensions. Extensions were never involved. Read §1–§4 as the symptom
> analysis they are, and §10 for the actual cause.

---


**Date:** 2026-08-08
**Repo:** `/home/tefera/Desktop/Revora` · **Branch:** `seo/about-page-and-canonicals` (base `8bcb2f1`)
**Supersedes:** `2026-08-08-landing-v4-implemented-flicker-defect-unresolved-session-handoff.md`
**Working tree:** 7 files modified, **nothing committed.** No PR.

---

## 0. STATUS

| | State |
|---|---|
| Root cause of the flicker | ✅ **Found, proven, and FIXED — a stale service worker (§10)** |
| Is it the CSS? | ❌ **No.** H1–H5 disproven with a negative control (§2) |
| Does it affect the deployed site? | ❌ **No.** Production re-verified across 3 loads with the worker in control (§10.4) |
| Was it the owner's extensions? | ❌ **No — §4 was wrong.** All four are innocent (§10.6) |
| Regression test | ✅ `tests/unit/revora/sw-dev-teardown.test.ts`, verified to fail without the fix |
| Four gates + a11y e2e + §11.1 budget | ✅ Green, baseline held (§6) |
| Committed? | ⛔ **No** |

**One line:** the page was never broken. A service worker registered on
`localhost:3000` by an earlier **production** build kept controlling the **dev**
server — same origin, permanent, client-side — and reload-looped it. That loop is
the flicker.

---

## 1. Root cause

### 1.1 The mechanism

```
page loads in owner's Firefox
  → GET /_next/static/chunks/%5Bturbopack%5D_browser_dev_hmr-client_hmr-client_ts_*.js  FAILS
  → Fast Refresh runtime never initialises
  → Next's error recovery does a FULL PAGE RELOAD
  → repeat
```

Every reported symptom is one frame of that loop, caught mid-reload:

| Owner's words | What it actually is |
|---|---|
| "keeps flickering" / "keeps refreshing" | the reload loop itself |
| "some parts are not visible" | images cut off mid-fetch — the broken-image glyph on the hero showpiece |
| (frame 24 of the recording) | the page rendered with **no CSS at all**, raw Times New Roman — dev injects CSS via JS, and the JS died |
| (frame 29) | fully blank — a reload in flight |
| loading spinner never stops, all 15s | requests aborted by the next reload before they finish |

### 1.2 The primary evidence

`.next/dev/logs/next-development.log`, written by the owner's own browser
(`moz-extension://` in the trace proves it is their Firefox, not a test run):

```
00:03:57.310 Browser INFO   Download the React DevTools ...          ← page load
00:03:57.310 Browser ERROR  ChunkLoadError: Failed to load chunk
                            /_next/static/chunks/%5Bturbopack%5D_browser_dev_hmr-client_hmr-client_ts_1mojsay._.js
00:03:57.311 Browser WARN   ObjectMultiplex - orphaned data for stream "metamask-multichain-provider"   (×10)
```

Load and failure are in the **same millisecond**. The MetaMask "orphaned stream"
warnings are the page context being torn down under it.

⚠️ **Why the log shows the error only once, not on a loop:** `hmr-client.ts` *is* the
thing that pipes browser console back to the dev server. Once it fails, the pipe is
dead and every subsequent reload is invisible server-side. One entry, then silence,
is exactly the signature of this bug — do not read it as "it only happened once."

### 1.3 Why it is dev-only

`[turbopack]/browser/dev/hmr-client/hmr-client.ts` does not exist in a production
build. Verified: `curl -s http://localhost:3000/ | grep -c hmr-client` → `0` against
`npm run start`.

---

## 2. What is now disproven — do not spend another session here

The prior handoff's §2.3 bisect ladder is **dead**. Do not comment out CSS properties.

| Hypothesis | Verdict | How |
|---|---|---|
| **H2** `will-change: transform` on `.landing-nav` | ❌ **not the cause** | present and untouched during a clean Firefox run that showed zero errors |
| **H1** `backdrop-filter: blur(14px)` on the sticky nav | ❌ not the cause | same run; `navBg` resolved, nav rendered correctly |
| **H3** the marquee animation | ❌ not the cause | same run |
| **H4** `contain: paint` on `.landing-marquee` | ❌ not the cause | same run |
| **H5** "missing parts" is a separate bug | ❌ no | image loaded at `naturalWidth: 780` in every clean run |
| **H6** environmental | ✅ **CONFIRMED** | this is it |

### 2.1 The negative control, and why it took two runs

Run 1 used Playwright's **bundled** Firefox (150.0.2) — clean. That was not yet
conclusive, because it changed **two** variables against the owner: no extensions
*and* a different Gecko build.

Run 2 isolated the second variable: the owner's **system Firefox 142**, clean temp
profile, pointed at the same dev server. 25 seconds, **one benign log line, zero
errors.**

⚠️ Playwright **cannot** drive stock Firefox (`-juggler-pipe` is unsupported; launch
fails). To test the system build, launch it directly and read the dev log — the dev
server captures browser console for you:

```bash
LOG=.next/dev/logs/next-development.log; BEFORE=$(wc -l < $LOG)
PROF=$(mktemp -d); /usr/bin/firefox --headless -no-remote -profile "$PROF" http://localhost:3000/ &
sleep 25; kill -9 $!; tail -n +$((BEFORE+1)) $LOG
```

Both variables isolated ⇒ **the browser build is exonerated; the variable is the
owner's profile.**

---

## 3. Verified clean

| Config | Browser | Result |
|---|---|---|
| `next dev` | Playwright Firefox 150, clean profile | 0 errors, 0 failed requests, no reload loop, 542 CSS rules, image 780px |
| `next dev` | **system Firefox 142**, clean profile | 0 errors |
| **`npm run build && npm run start`** | Firefox | **0 errors, 0 failed requests, no reload loop, 538 CSS rules, image 780px, `h1` correct** |

Production CSP confirmed byte-identical to before the dev change:
`script-src 'self' 'unsafe-inline'` — no `'unsafe-eval'`. The dev-only guard works.

---

## 4. ⚠️ THE ONE OPEN QUESTION — 30 seconds of the owner's time

Four extensions are active in `ivva18xa.default-release`: **TunnelBear VPN**,
**LastPass**, **MetaMask**, **vidIQ**.

**Ask the owner to run these, in this order — cheapest first:**

**Step 1 — hard reload (one keystroke).** On the flickering page press
**`Ctrl+Shift+R`**. Rationale: three *different* `hmr-client` chunk hashes are sitting
in `.next/static/chunks` (`1mojsay`, `1p6ec2_`, `0tsedey`), so the hashes demonstrably
rotate. A cached document pointing at a hash the server has moved past produces this
exact signature. Costs nothing and needs no restart.

**Step 2 — disable all extensions.** Firefox → **Help → Troubleshoot Mode… →
Restart** (disables every extension, keeps the profile otherwise intact). Load
`http://localhost:3000/`.

- **Flicker gone** ⇒ an extension. Leave Troubleshoot Mode, disable **TunnelBear
  first** (a VPN proxy extension intercepts every request and is the strongest
  candidate), reload, then work down: MetaMask, LastPass, vidIQ.
- **Flicker remains** ⇒ not extensions. Next: Settings → Privacy → Clear Data →
  Cached Web Content, then check for a proxy pref in `about:config`.

### 4.1 ⛔ Do NOT trust an automated extension bisect without a control

I built one (fresh profiles, one `.xpi` each) and it reported "0 errors" for
MetaMask, TunnelBear, and all-four. **Those results are invalid.** A no-extension
control run through the same harness *also* returned 0 — the background unit suite
was saturating the CPU and the page never finished loading inside the 30s window.
The harness was measuring nothing.

Reporting those runs as clean would have been false fix #4. **Always run the
no-extension control in the same conditions**, and treat "0 log lines" as
"inconclusive" unless the control produces its expected 1 line.

---

## 5. Changes made this session

| File | Change | Why |
|---|---|---|
| `app/globals.css` | **removed** `will-change: transform` from `.landing-nav` | **Verified reasons:** the flicker it was added to fix is disproven (§2), and `backdrop-filter` already promotes this element, so the hint buys nothing. Removing it restores the pre-session state. Replaced with a ⛔ comment so it is not re-added. ⚠️ **Unverified, stated as a prior only:** `will-change: transform` on a `position: sticky` box is a known Gecko jitter pattern. **I did not test scroll jitter** — the pixel-diff in §5.1 tests the page at rest, which cannot see it. Do not repeat that concern as established fact. |
| `app/globals.css` | **rewrote** the `.landing-marquee-track` comment | it asserted "⚠️ `will-change` AND `contain` ARE THE FLICKER FIX … ⛔ Do not remove either". That is false and would have sent the next session back down the dead ladder. **Properties kept** (an infinite transform animation legitimately wants them), justification corrected. |
| `playwright.config.ts` | **added** a `Desktop Firefox` project | §1.2 of the prior handoff named the process failure: three Chromium-only "verifications" of a Firefox report. Now runnable: `npm run e2e -- --project="Desktop Firefox"`. ⚠️ needs `npx playwright install firefox` once per machine. |

Carried forward untouched from the prior session: `app/page.tsx`, `DESIGN.md`,
`docs/safety/copy-ledger.md`, `docs/ops/play-listing.md`, `next.config.ts`.

**Keep `next.config.ts`'s dev-only `'unsafe-eval'`** (prior fix #3). It was a real
bug and production is byte-identical — re-verified this session.

### 5.1 Visual proof the CSS change is inert

Full-page Firefox screenshots before/after, animations paused, pixel-diffed:
identical page height (11,375px), differences confined to the marquee's paused
offset and Next's dev badge. `will-change` is a hint with no visual effect; confirmed
rather than asserted.

**Containing-block check** (removing `will-change: transform` stops the element being
a containing block, which would re-anchor any `position: fixed`/`absolute`
descendant): `.landing-nav` contains only `.landing-wordmark` and
`.landing-nav-links`, and **no `.landing-nav*` rule declares `position: fixed` or
`absolute`**. Nothing to re-anchor. Checked, not inferred.

⚠️ **What §5.1 does NOT cover:** behaviour during scroll. The screenshots are static.
If sticky-nav jitter is ever reported in Firefox, that is untested ground either way.

---

## 6. Gates — all green, baselines held

```
typecheck        ✅
lint             ✅ 0 errors, 2 warnings (both pre-existing <img> in app/page.tsx:361,704 —
                    the capture appears twice by design; untouched this session)
contract         ✅ 9 validators
test:revora      ✅ 918/918, 56 files      (was 914/55 — +4 from the new SW regression test)
npm test         ✅ 2209 passed | 2 skipped (2211), 190 files | 1 skipped
                    (was 2205/2207, 189 files — delta is exactly the 4 new tests)
e2e landing-a11y ✅ 12/12 (was 9/9 — see §6.1)
measure-landing  ✅ 11 exits · worst desert 1,921px · ceiling 2,001px · within budget
```

Every number above was run against the FINAL state of the tree, after the service
worker fix in §10 and its regression test landed. The unit-test deltas reconcile
exactly to the four tests added — nothing else moved.

### 6.1 The a11y suite went 9 → 12, and that is the point

The three new tests are the `Desktop Firefox` project from §5 running the same three
assertions. **Firefox passes all three**, including the axe critical/serious scan:

```
✓ 10 [Desktop Firefox] › landing page has no critical or serious a11y violations (7.8s)
✓ 11 [Desktop Firefox] › landing skip link moves focus to the hero, not just scroll (1.8s)
✓ 12 [Desktop Firefox] › landing landmarks and list semantics stay intact (2.8s)
```

**The new baseline for this spec is 12, not 9.** A future session that sees 9 should
suspect the Firefox browser binary is missing on that machine
(`npx playwright install firefox`), not that tests were deleted.

⚠️ **Wider blast radius, not verified:** the `Desktop Firefox` project applies to
**every spec in the suite**, not just this one. Only `landing-a11y` was run under
Firefox this session. A full `npm run e2e` may surface Firefox-specific failures in
specs that have never once executed on Gecko. That is a known unknown, and finding
real Gecko bugs there is the project working as intended — but budget for it rather
than reading it as a regression from this session.

Identical to the prior handoff's baseline. Nothing regressed.

---

## 7. ⚠️ Operational gotchas learned the hard way

- 🚨 **`pkill -9 -f "next-server"` kills the shell running it.** The pattern matches
  the `bash -c` process's own command line, so the command dies mid-script with exit
  1 and no output. It cost two silent failures this session. Use a bracket class:
  ```bash
  pkill -9 -f 'next[-]server'
  ```
  The prior handoff recommends the self-matching form. **It does not work.**
- **Playwright cannot drive `/usr/bin/firefox`.** `executablePath` fails at launch
  (`-juggler-pipe` unsupported). Use Playwright's bundled Firefox for automation, and
  the direct-launch + dev-log trick in §2.1 when the *system* build is the question.
- `npm run typecheck` does `rm -rf .next/dev/types .next/types`. Harmless to a
  running dev server here, but it does touch `.next`.
- The full unit suite runs >10 min. Do not run timing-sensitive browser checks
  alongside it — that is exactly what invalidated §4.1.
- Write scratch scripts that `import "playwright"` **into the repo root** (module
  resolution follows the file, not cwd) and delete them after. Watch for
  `fx-video/` landing in `git status`.

---

## 8. Next actions

1. **Owner runs the Troubleshoot Mode test (§4).** Everything else waits on it.
2. If an extension is named: they exclude `localhost` in it (TunnelBear has a
   whitelist) or toggle it off while developing. No code change on our side.
3. Meanwhile the page can be previewed with **zero flicker** via a production build —
   it has no HMR client at all, so the bug cannot occur:
   ```bash
   pkill -9 -f 'next[-]server'      # ⛔ MANDATORY FIRST. `next build` rewrites .next
                                    # underneath a live dev server → torn chunks (§7).
   npm run build && npm run start
   ```
4. Once the owner confirms Firefox is clean, re-run §6 and `/ship`. **Nothing is
   committed yet.**

---

## 9. Suggested opening prompt for the next session

```
Read docs/handoff/2026-08-08-flicker-root-caused-dev-only-hmr-session-handoff.md.

The flicker is root-caused: next dev's HMR client chunk fails to load in the owner's
Firefox PROFILE, Next full-reloads in response, and that loop is the flicker. It is
dev-only — production was verified clean in Firefox. The CSS is exonerated; do NOT
bisect globals.css, and do not re-add will-change to .landing-nav (§5).

The only open item is §4: which of the owner's four extensions does it. That needs 30
seconds of owner time in Firefox Troubleshoot Mode, not more automation — and read
§4.1 before you try to automate it, because my automated bisect produced convincing
"all clean" results that a control run proved were measuring nothing.

All gates are green and baselines held. Nothing is committed.
```

---

## 10. THE ACTUAL ROOT CAUSE — stale service worker (written after §1–§9)

### 10.1 Mechanism

`localhost:3000` serves **`next dev` and `next start` from the same origin**. A
service worker has no idea which one registered it — it just controls the origin.

```
someone runs `npm run build && npm run start` on :3000   (I did this twice today)
  → SwRegister registers /sw.js?v=<build id>            (NODE_ENV=production)
  → SW is now active for http://localhost:3000, permanently
later: `npm run dev` on :3000
  → the SW still controls navigations  ← "Transferred: service worker"
  → dev serves /sw.js no-store → every update check yields a "new" worker
  → install → skipWaiting() → controllerchange → reload → repeat
  → in-flight Turbopack chunk requests are cancelled  ← NS_BINDING_ABORTED
```

Registration is **client-side state**. It survives `rm -rf .next`, a dev-server
restart, Ctrl+Shift+R, and clearing the HTTP cache. That is why three sessions of
server-side and CSS work changed nothing.

### 10.2 Why it defeated every "clean" test — the trap to remember

The two instincts for testing something clean are the two places a service worker
does not exist:

| Where we tested | Why it looked fine |
|---|---|
| Private/incognito window | **service workers do not run in Firefox private browsing** |
| Fresh temp profile (both my clean runs) | no registration in a new profile |
| Playwright contexts | Playwright defaults to `serviceWorkers: "block"` |
| Chromium | separate registration store; never had one |

⚠️ **A bug that vanishes in a private window and in a fresh profile is a
client-side *state* bug — service worker, IndexedDB, localStorage, a permission.
It is not a CSS bug.** That single inference would have saved four sessions. My
own §4 read the same evidence and concluded "extensions", which was wrong.

### 10.3 The fix

`components/sw-register.tsx` — the dev branch now tears down existing
registrations instead of only declining to create one:

```ts
if (process.env.NODE_ENV !== "production") {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => Promise.all(regs.map((r) => r.unregister())))
    .catch(() => {});
  return;
}
```

Idempotent, non-fatal, and the only code path that can reach a machine already in
the broken state. **A developer stuck in this loop fixes it by loading the dev page
once.** No DevTools archaeology required.

Production is deliberately unchanged — the offline fallback and push both need the
worker.

### 10.4 Verified

| Check | Result |
|---|---|
| SW registered on :3000, then dev page loaded | `getRegistrations()` → **0**, no NS_BINDING_ABORTED, no reload loop |
| **Production across 3 loads, worker in control** (`controlled: true` on loads 2–3) | 538 CSS rules, correct `h1`, exactly 4 navigations, **0 console errors** |
| Regression test with fix reverted | **2 of 4 assertions fail** — the test is real |

⚠️ §3 of this document claimed "production verified clean" off a **single** page
load. That was insufficient: a service worker only takes control on the *next*
navigation, so a one-load test structurally cannot see it. §10.4 redoes it properly
across three loads. The conclusion held — but the original check did not support it.

### 10.5 What the owner still has to do once

The fix heals new loads, but their currently-registered worker is torn down only
when they load the dev page **with this code**. If anything looks stuck:

`F12 → Application → Service Workers → Unregister`, or visit `about:serviceworkers`.

### 10.6 Corrections to earlier sections

- **§4 (extensions) is WRONG.** TunnelBear, MetaMask, LastPass and vidIQ are all
  innocent. The MetaMask console noise was a *symptom* — its stream orphaning as
  the page context was torn down by the reload loop.
- **§4.1 still stands and is still the most useful paragraph in this file:** the
  automated extension bisect reported "all clean" and a control run proved it was
  measuring nothing. It was measuring nothing about a hypothesis that was also
  wrong.
- **§2's negative controls were sound but the inference from them was not.**
  "Clean profile is clean" narrows to client-side state; it does not single out
  extensions.

---

## 11. ⛔ STOP — status correction. The fix in §10 DID NOT WORK.

### 11.1 What happened

After §10 shipped, the owner reported the loop persisting. The dev log confirmed
it: **150 ChunkLoadErrors, 45+ page loads, still cycling every ~3s**, with the
final entry timestamped after the fix was live.

**Why §10.3 could never have worked:** it runs in a React `useEffect`. A browser
already in the reload loop never finishes hydrating, so the effect never executes.
**A fix delivered by the broken page cannot reach an already-broken browser.**

**Why my verification missed that:** the test registered a worker and loaded the
dev page, but the worker never reached `controller != null` — the page was healthy,
so the effect ran and cleaned up. It verified the fix on a machine that did not
have the bug. Same structural error as the three Chromium "verifications" before it:
**a check that cannot observe the failure it claims to rule out.**

### 11.2 Second attempt, also unconfirmed

`public/sw.js` now carries a kill switch (§11.4) that needs no page JS: on a
loopback hostname the worker unregisters itself, clears caches, and reloads
controlled tabs. Browsers re-fetch `sw.js` on navigation update checks, so a stuck
worker should install it and self-destruct.

Verified: syntax valid, dev serves the new bytes (`IS_LOCAL_DEV` ×5,
`Cache-Control: public, max-age=0`), hostname logic correct, 8/8 pins pass and 3
fail without it.

⛔ **NOT verified: that it clears the owner's actual stuck worker.** The loop was
still running after it went live. Either the update check is not firing, or the
service worker is not the cause.

⚠️ **I could not reproduce the loop locally at all.** A healthy dev page tears the
worker down before it can take control, so there is no way to bootstrap into the
broken state from a clean machine. Every "verified" claim about this fix is
therefore about mechanism, not about the owner's symptom.

### 11.3 THE DECISIVE TEST — do this before writing any more code

Have the owner run **one** action, which both fixes and diagnoses:

> `about:serviceworkers` → find the `localhost:3000` entry → **Unregister**.
> (Or padlock icon → Clear cookies and site data, the bigger hammer.)
> Then close **every** localhost:3000 tab and open one fresh.

| Outcome | Meaning | Next |
|---|---|---|
| **Loop stops** | Service worker confirmed. §11.4 is the right fix; find out why the update check did not fire on its own. | Keep §11.4, investigate propagation |
| **Loop continues** | ⛔ **The service worker is INNOCENT.** §10 and §11 are both wrong. | Start over — see §11.5 |

Also ask what `about:serviceworkers` actually lists. If nothing is registered for
localhost:3000, the whole §10 diagnosis collapses immediately.

### 11.4 The kill switch (keep regardless of outcome)

A worker must never control a dev server — `localhost:3000` serves `next dev` and
`next start` from one origin, so one local production run captures everybody's dev
server permanently. `public/sw.js` now self-destructs on loopback hostnames, and
the `fetch` interceptor is guarded so it cannot take over a dev navigation while
the teardown runs. That is correct independent of whether it explains this bug.

⚠️ Trade-off, accepted deliberately: the service worker can no longer be exercised
against a local `next start`. Test the offline fallback and push on a preview
deployment instead.

### 11.5 If the service worker turns out to be innocent

Still true and not worth re-deriving:
- The CSS is exonerated (§2) — a headed Firefox run with a real compositor at 110%
  was stable for 30s, sampled every 2s.
- Production is clean, verified across 3 loads with a worker in control (§10.4).
- The owner's extensions are innocent (§10.6).
- Confirmed client-side state: clean profile fine, private window fine, normal
  window broken. Service worker was the best candidate in that class; if it is
  ruled out, the remaining ones are **localStorage / IndexedDB / a site
  permission / a per-site setting** for `http://localhost:3000`.

The unexplored lead: what *triggers* the reload. `NS_BINDING_ABORTED` on the chunks
is the reload cancelling in-flight requests, i.e. a **consequence**. Nobody has yet
identified what issues the reload. Ask the owner to set DevTools → Network →
**Preserve Log**, then read what appears immediately *before* each reload.
