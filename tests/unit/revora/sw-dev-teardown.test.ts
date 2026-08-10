import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The dev service-worker teardown (2026-08-08).
 *
 * WHAT BROKE: `localhost:3000` serves `next dev` AND `next start` from the same
 * origin, so a single `npm run build && npm run start` permanently registers a
 * service worker that then controls everybody's dev server. Registration is
 * client-side state: it survives `rm -rf .next`, hard reload, and clearing the
 * HTTP cache. The controlled dev page reload-loops (see the comment block in
 * sw-register.tsx) and dev chunk requests die with NS_BINDING_ABORTED.
 *
 * It presented as "the landing page flickers in Firefox", was reported four
 * times, and burned three sessions of CSS bisecting — because it is invisible
 * in a private window and in a fresh profile, the two places you naturally
 * reach for to "test it clean". Declining to register in dev was NOT enough;
 * nothing tore down a registration that already existed.
 *
 * ⚠️ WHAT THIS TEST IS: a source pin, the same idiom as landing-wiring-pins and
 * copy-pins. The logic lives in a `useEffect`, which needs a DOM to execute, and
 * neither jsdom nor happy-dom is installed (vitest runs `environment: "node"`).
 * Adding a DOM dependency to execute one effect was not worth it.
 *
 * ⚠️ WHAT THIS TEST IS NOT: proof the teardown works at runtime. That was
 * verified manually in Firefox — register a SW on localhost:3000, load the dev
 * page, `getRegistrations()` returns 0. If you change this component, re-run
 * that check; a green test here only means the call still textually exists.
 */

const SOURCE = readFileSync(
  join(process.cwd(), "components/sw-register.tsx"),
  "utf8"
);

// Everything from the dev guard to the `return` that closes it.
function devBranch(): string {
  const start = SOURCE.indexOf('process.env.NODE_ENV !== "production"');
  expect(start, "the dev guard must still exist").toBeGreaterThan(-1);
  const end = SOURCE.indexOf("return;", start);
  expect(end, "the dev guard must still early-return").toBeGreaterThan(start);
  return SOURCE.slice(start, end);
}

describe("service worker: dev teardown", () => {
  it("actively unregisters existing workers in dev, not just declines to register", () => {
    const dev = devBranch();
    expect(dev).toContain("getRegistrations");
    expect(dev).toContain("unregister");
  });

  it("still early-returns in dev so no new worker is registered", () => {
    // register() must be reachable ONLY after the dev guard has returned.
    const guard = SOURCE.indexOf('process.env.NODE_ENV !== "production"');
    const register = SOURCE.indexOf(".register(");
    expect(register).toBeGreaterThan(guard);
  });

  it("keeps the teardown non-fatal — a rejected unregister must not break the page", () => {
    // Registering a service worker is a progressive enhancement. An unhandled
    // rejection here would surface as an error overlay on every dev page load,
    // which is the exact class of thing this whole fix is removing.
    expect(devBranch()).toMatch(/\.catch\(/);
  });

  it("leaves production registering the worker as before", () => {
    // The offline fallback and push both depend on it; production behaviour is
    // deliberately unchanged and was re-verified across three loads with the
    // worker in control.
    expect(SOURCE).toContain("/sw.js?v=");
  });
});

/**
 * The kill switch in public/sw.js — the PRIMARY defence.
 *
 * ⚠️ Why the page-side teardown above is not sufficient on its own: it runs in a
 * React effect, and once a browser is already loop-reloading, the page never
 * hydrates, so the effect never executes. A fix delivered by the broken page
 * cannot reach an already-broken browser. The worker therefore has to be able to
 * destroy itself, which needs no page JS — the browser re-fetches sw.js on
 * navigation update checks.
 */
const SW = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");

// ⚠️ Unlike the pins above, this one EXECUTES the guard rather than grepping for
// it. The predicate depends only on a hostname string, so it needs no DOM and
// runs fine under `environment: "node"`. It has to execute: the guard is now a
// pair of character classes, and a source pin cannot tell a correct range from a
// typo'd one. The suite already shipped a Firefox defect that passed three
// Chromium verifications — an assertion that cannot observe the failure is worse
// than no assertion, because it reports green.
function isLocalDev(hostname: string): boolean {
  const start = SW.indexOf("const IS_LOCAL_DEV =");
  expect(start, "the kill-switch guard must still exist").toBeGreaterThan(-1);
  const end = SW.indexOf(";", start);
  expect(end, "the guard must terminate").toBeGreaterThan(start);
  const expr = SW.slice(start + "const IS_LOCAL_DEV =".length, end);
  return new Function("HOST", `return (${expr});`)(hostname) as boolean;
}

describe("service worker: local-dev kill switch", () => {
  it("treats every local dev origin as local dev", () => {
    for (const host of [
      // loopback
      "localhost",
      "127.0.0.1",
      "[::1]",
      "::1",
      // ⚠️ LAN origins. `next start` on one of these is how you test push and
      // the offline fallback on a phone, so it is precisely where the worker
      // gets installed — and where the loop came back before this was covered.
      "192.168.1.5",
      "10.0.0.4",
      "172.16.0.9",
      "172.31.255.254",
      // mDNS
      "tefera-laptop.local"
    ]) {
      expect(isLocalDev(host), `${host} must be recognised as local dev`).toBe(
        true
      );
    }
  });

  it("leaves real deployed origins controlled — the worker must still work in production", () => {
    // The inverse assertion matters as much as the one above: widening the kill
    // switch must never reach revora.plus, or the offline fallback and push
    // silently die for every real user.
    for (const host of [
      "revora.plus",
      "www.revora.plus",
      "revora-git-main.vercel.app",
      // just outside RFC1918 — pins the range edges, which is the whole reason
      // this test executes the guard instead of grepping it
      "172.32.0.1",
      "172.15.0.1",
      "192.169.1.1",
      "11.0.0.1"
    ]) {
      expect(isLocalDev(host), `${host} must NOT be treated as local dev`).toBe(
        false
      );
    }
  });

  it("unregisters itself on a dev origin", () => {
    expect(SW).toMatch(/IS_LOCAL_DEV/);
    expect(SW).toMatch(/registration\.unregister\(\)/);
  });

  it("guards the fetch interceptor so it cannot control a dev navigation", () => {
    // This handler is what made the dev document report "Transferred: service
    // worker" in DevTools. addEventListener is additive, so an unguarded
    // handler would still intercept while the worker is being torn down.
    const fetchAt = SW.indexOf('addEventListener("fetch"');
    expect(fetchAt).toBeGreaterThan(-1);
    const guardAt = SW.lastIndexOf("if (!IS_LOCAL_DEV)", fetchAt);
    expect(guardAt, "the fetch handler must sit inside an !IS_LOCAL_DEV block").toBeGreaterThan(-1);
  });

  it("keeps the offline fallback and push wiring for real origins", () => {
    expect(SW).toContain("/offline.html");
    expect(SW).toMatch(/addEventListener\("push"/);
  });
});
