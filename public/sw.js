// RE-07: the cache name is stamped from the registration URL's ?v= (the build
// id, see components/sw-register.tsx). A hardcoded "revora-v1" meant a
// corrected offline.html could never propagate: the SW bytes never changed, so
// no reinstall ever re-cached it. A new build id → new registration URL → new
// SW install → fresh cache; `activate` below deletes the old ones.
const VERSION = new URL(self.location.href).searchParams.get("v") || "v1";
const CACHE = `revora-${VERSION}`;
const OFFLINE_URL = "/offline.html";

// ─────────────────────────────────────────────────────────────────────────────
// KILL SWITCH: this worker must never control a local dev server.
//
// 2026-08-08. `localhost:3000` serves `next dev` AND `next start` from the same
// origin, and a service worker owns an ORIGIN, not a server. So a single
// `npm run build && npm run start` permanently installs this worker over
// everyone's dev server. The controlled dev page reload-loops (~3s/cycle here,
// documented as ~5/s in components/sw-register.tsx) and dev chunk requests die
// with NS_BINDING_ABORTED. It cost four sessions.
//
// ⚠️ WHY THE KILL SWITCH LIVES HERE AND NOT IN THE PAGE. sw-register.tsx also
// unregisters in dev, but that runs in a React effect — and the reload loop
// restarts the page before React hydrates, so the effect never executes. A fix
// delivered by the broken page cannot reach a browser that is already broken.
// This one needs no page JS: the browser re-fetches sw.js on navigation update
// checks, so a stuck worker installs this version and destroys itself.
//
// Losing the worker on a local `next start` is deliberate and harmless — the
// offline fallback and push cannot be meaningfully exercised on the same origin
// a dev server keeps reclaiming. Deployed origins are unaffected.
// ⚠️ Loopback is NOT the whole set. `next dev` binds 0.0.0.0 and prints a
// Network URL, and testing push or the offline fallback on a real phone needs a
// PRODUCTION build — so `next start` on http://192.168.x.x:3000 is exactly how
// you'd exercise this worker, and it registers the controller on that origin.
// Come back with `next dev` on the same LAN IP and the reload loop returns,
// with only sw-register.tsx defending — which the block above explains is not
// enough. Private ranges and mDNS names are dev origins too.
const HOST = self.location.hostname;
const IS_LOCAL_DEV =
  ["localhost", "127.0.0.1", "[::1]", "::1"].includes(HOST) ||
  /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(HOST) ||
  /\.local(host)?$/.test(HOST);

if (IS_LOCAL_DEV) {
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (event) => {
    event.waitUntil(
      (async () => {
        await caches
          .keys()
          .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
          .catch(() => {});
        await self.registration.unregister().catch(() => {});
        // Reload every controlled tab ONCE, now uncontrolled, so a browser
        // already stuck in the loop lands on a clean page instead of waiting
        // for the user to notice.
        const wins = await self.clients.matchAll({ type: "window" });
        for (const w of wins) {
          if ("navigate" in w) w.navigate(w.url).catch(() => {});
        }
      })()
    );
  });
}
// ─────────────────────────────────────────────────────────────────────────────

// ⚠️ Everything below is guarded on `!IS_LOCAL_DEV`. addEventListener is
// additive — without the guard the install/activate/fetch handlers below would
// run ALONGSIDE the kill switch above, re-caching the offline page and keeping
// the fetch interceptor live on the very origin we are trying to release.
if (!IS_LOCAL_DEV) {
  self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE_URL)));
    self.skipWaiting();
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
    );
    // No clients.claim(): claiming the current page mid-session makes WebKit hang on the
    // next navigation. The offline fallback only needs to run on reopen — a fresh
    // navigation the already-active SW controls without claiming.
  });
}

// Daily nudge (P5): render the push payload and open the app on tap. One
// gentle reminder a day — the server enforces the cadence; the SW only
// displays what it's sent.
self.addEventListener("push", (event) => {
  let payload = {
    title: "Revora",
    body: "Ready for today? Check your first meal.",
    class: "generic",
    stage: "none"
  };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // keep the default copy on a malformed payload
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "revora-daily-nudge", // same tag: never stacks duplicates
      // Bounded routing metadata only (no health text) — read on click so the
      // app can emit nudge_opened {class, stage} (§10.1).
      data: { class: payload.class, stage: payload.stage }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const params = new URLSearchParams();
  params.set("nudge", typeof data.class === "string" ? data.class : "generic");
  params.set("stage", typeof data.stage === "string" ? data.stage : "none");
  const target = `/check?${params.toString()}`;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      // Focus an open tab and route it to the check page with the nudge params;
      // otherwise open a fresh window there.
      const existing = wins.find((w) => "focus" in w);
      if (existing) {
        if ("navigate" in existing) existing.navigate(target).catch(() => {});
        return existing.focus();
      }
      return clients.openWindow(target);
    })
  );
});

// ⚠️ Guarded: this is the handler that made the dev document report
// "Transferred: service worker" in DevTools. On a dev origin it must never
// intercept a navigation — the worker is on its way out, and taking over
// navigations while Turbopack rotates chunk hashes underneath is the loop.
if (!IS_LOCAL_DEV) {
  self.addEventListener("fetch", (event) => {
    const { request } = event;
    if (request.method !== "GET") return; // never intercept POST /api/check
    if (request.mode !== "navigate") return; // only navigations get the offline fallback
    // Network-first: real page when online, cached offline page only when the fetch fails.
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(CACHE);
          return (await cache.match(OFFLINE_URL)) || Response.error();
        }
      })()
    );
  });
}
