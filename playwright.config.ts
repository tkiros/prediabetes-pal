import { defineConfig, devices } from "@playwright/test";

import { includesTrialWall } from "./scripts/e2e-spec-selection";
import { isolatedE2ERuntimeEnv } from "./scripts/e2e-runtime-env";

// The PAYWALL_MODE=trial server on :3101 is only needed when the trial-wall spec
// is actually in the run. Both E2E servers read the same immutable production
// source revision, built separately because static pages bake PAYWALL_MODE.
//
// SUPPRESSION RULE: only a set of CONCRETE spec-file filters (each arg
// endsWith(".spec.ts")) that omit trial-wall suppresses :3101. Everything else
// boots it — a whole-suite run, an explicit trial-wall filter, AND any
// directory-style/ambiguous filter (e.g. `tests/smoke/`, `tests/`), because a
// directory can contain trial-wall.spec.ts and we cannot prove otherwise.
//
const runsTrialSpec = includesTrialWall(process.argv.slice(2));
const isolatedRuntimeEnv = isolatedE2ERuntimeEnv(process.env);

const trialWebServer = {
  // Second production server on :3101 running PAYWALL_MODE=trial for
  // tests/smoke/trial-wall.spec.ts. Paywall mode is resolved server-side
  // (app/subscribe/page.tsx → lib/server/pricing.paywallMode()), so the
  // trial wall can only be exercised by a genuinely trial-mode server; the
  // :3100 server is pinned to PAYWALL_MODE=legacy (trial is the code
  // default now) for billing-pages.spec. One server cannot serve both
  // modes at once.
  command: "npx next start --hostname 127.0.0.1 --port 3101",
  url: "http://127.0.0.1:3101",
  reuseExistingServer: false,
  stdout: "pipe" as const,
  stderr: "pipe" as const,
  timeout: 60_000,
  env: {
    ...isolatedRuntimeEnv,
    PAYWALL_MODE: "trial",
    NEXT_DIST_DIR: ".next-e2e-trial",
    NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3101"
  }
};

export default defineConfig({
  testDir: "./tests/smoke",
  // Exercise the same optimized server/runtime shape that is deployed.
  // `npm run e2e` prepares exact legacy + trial builds before invoking this
  // config. Running against `next dev` caused Fast Refresh rebuilds while
  // parallel browsers were hydrating, leaving real assertions stranded on
  // server-rendered loading shells.
  //
  // The setup still probes every owned route and proves one browser hydration
  // before workers start. It fails on bad responses; it does not widen product
  // assertions or hide a broken route.
  globalSetup: "./tests/smoke/global-setup.ts",
  // Axe scans and cold route compilation can exceed Playwright's 30s default
  // on the documented slow-filesystem CI/worktree path. Product assertions
  // still use Playwright's short expect timeout; this only prevents the whole
  // test budget from expiring while several accessibility scans complete.
  timeout: 90_000,
  fullyParallel: true,
  // This workstation intermittently returns Chromium net::ERR_NETWORK_CHANGED
  // for localhost script chunks when several fresh browser processes start
  // together. One worker produced 10/10 clean cold-context repetitions and
  // still exercises every browser/project; browser-flow parallelism itself is
  // not a product contract.
  workers: 1,
  // A retry turns a timing defect into a superficially green release gate.
  // Production-server E2E must pass the first time; failures retain traces.
  retries: 0,
  // ci.yml uploads playwright-report/ on failure, but nothing ever wrote that
  // folder — the default reporter has no file output, so every red CI run threw
  // its evidence away and had to be re-diagnosed locally against a dev box with
  // very different timing (2026-07-22). The html reporter fills the folder the
  // workflow already asks for, and the trace makes a failure replayable.
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    trace: "retain-on-failure",
    baseURL: "http://127.0.0.1:3100",
    // Block service workers in E2E: WebKit's automation driver hangs on SW-controlled
    // navigations (a Playwright-WebKit limitation), and tests should never run against a
    // cached SW. The SW itself is covered by tests/unit/revora/pwa-assets.test.ts (file
    // contract) and the Phase 8.1 manual offline-launch matrix.
    serviceWorkers: "block",
    // The 2026-07-07 revamp added a small CSS motion layer (transitions +
    // result-card entrance). WebKit-under-parallel-load stalls its
    // element-stability checks on animated layouts; tests assert content, not
    // motion, and the app's prefers-reduced-motion block makes this a real
    // user path too.
    contextOptions: { reducedMotion: "reduce" as const }
  },
  webServer: [
    {
      command: "npx next start --hostname 127.0.0.1 --port 3100",
      url: "http://127.0.0.1:3100",
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 60_000,
      env: {
        ...isolatedRuntimeEnv,
        // Trial is now the code default (lib/server/pricing.ts), so the
        // legacy-mode assertions (billing-pages.spec, trial-wall's legacy
        // guard) need this server pinned to legacy explicitly.
        PAYWALL_MODE: "legacy",
        // Task 7 (P2.1): the paywall card now shows the annual plan ONLY when
        // GET /api/paywall returns an annual price — which the route gates on
        // this env being set (annual.priceId). Production configures it; the
        // e2e server must too, or the annual card is (correctly) hidden and
        // billing-pages.spec's annual assertion has nothing to match. A dummy
        // id is fine — annual checkout is never exercised here (no Stripe).
        STRIPE_PRICE_ANNUAL: "price_e2e_annual_smoke_only",
        NEXT_DIST_DIR: ".next-e2e-legacy",
        NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100"
      }
    },
    ...(runsTrialSpec ? [trialWebServer] : [])
  ],
  projects: [
    {
      name: "Mobile Chrome",
      use: {
        ...devices["Pixel 5"]
      }
    },
    {
      name: "Mobile Safari",
      use: {
        ...devices["iPhone 12"]
      }
    },
    // AA-10: the app ships a desktop sidebar layout that no project ever
    // exercised — desktop-only regressions (sidebar nav, wide-viewport CSS)
    // were invisible to CI.
    {
      name: "Desktop Chrome",
      use: {
        ...devices["Desktop Chrome"]
      }
    },
    // 2026-08-08: the owner reported the landing page flickering with parts
    // missing, in Firefox. It was "fixed" three times and verified three times
    // in headless Chromium, because every project here was Chromium or WebKit —
    // the suite was structurally incapable of seeing a Gecko-specific defect and
    // reported green anyway. The defect turned out not to be Gecko's, but that
    // was luck: nothing here could have told us either way. This project is the
    // standing answer to that. Run it with:
    //   npm run e2e -- --project="Desktop Firefox"
    // ⚠️ Needs the browser downloaded once per machine: `npx playwright install
    // firefox`. It is NOT bundled with the chromium/webkit installs.
    {
      name: "Desktop Firefox",
      use: {
        ...devices["Desktop Firefox"]
      }
    }
  ]
});
