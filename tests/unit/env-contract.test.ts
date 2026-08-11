import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * WS-7 — the static env contract. Every environment variable the RUNTIME
 * surface reads (app/, lib/, middleware, proxy, auth, next.config) must be
 * documented in docs/ops/env-reference.md, or carry a reasoned exemption
 * below. Dev tooling under scripts/ is out of scope — it never runs in a
 * deploy. This is the gate that stops a new `process.env.X` from shipping
 * undocumented and being discovered for the first time during an incident.
 */

const ROOT = process.cwd();

// Platform/build metadata — set by Vercel/Next/the shell, not operator config.
const EXEMPT = new Set([
  // NODE_ENV / VERCEL_ENV are documented in env-reference.md, so they are
  // deliberately NOT exempt — the honesty check below enforces that split.
  "PATH",
  "CI",
  "TZ",
  "VERCEL_GIT_COMMIT_SHA",
  "VERCEL_OIDC_TOKEN",
  "NEXT_RUNTIME",
  "NEXT_DIST_DIR",
  // Sentry release identity is derived from the git SHA at build time
  // (lib/pal/sentry-release.ts), not operator-set.
  "SENTRY_RELEASE",
  "NEXT_PUBLIC_SENTRY_RELEASE",
  // Vitest/test-harness only.
  "VITEST"
]);

function referencedEnvNames(): Set<string> {
  const targets = [
    "app",
    "lib",
    "middleware.ts",
    "proxy.ts",
    "next.config.ts",
    "auth.ts"
  ].filter((p) => fs.existsSync(path.join(ROOT, p)));

  const out = execFileSync(
    "grep",
    ["-rhoE", String.raw`process\.env\.[A-Z][A-Z0-9_]+`, ...targets],
    { cwd: ROOT, encoding: "utf8" }
  );
  return new Set(
    out
      .split("\n")
      .filter(Boolean)
      .map((line) => line.replace("process.env.", ""))
  );
}

describe("env contract (WS-7)", () => {
  it("every runtime process.env reference is documented or exempt", () => {
    const docs = fs.readFileSync(
      path.join(ROOT, "docs/ops/env-reference.md"),
      "utf8"
    );
    const missing = [...referencedEnvNames()]
      .filter((name) => !EXEMPT.has(name))
      .filter((name) => !docs.includes(`\`${name}\``))
      .sort();
    expect(
      missing,
      `undocumented runtime env vars: ${missing.join(", ")} — add a row to docs/ops/env-reference.md (or a reasoned exemption)`
    ).toEqual([]);
  });

  it("an ambient key + fixture labels alone do NOT arm the live meal-photo eval (WS-7)", () => {
    // The eval's READY gate must demand the explicit EVAL_MEAL_PHOTO_LIVE=1
    // opt-in — a developer with OPENAI_API_KEY in their shell and fixtures on
    // disk must never buy vision calls by running the suite.
    const source = fs.readFileSync(
      path.join(ROOT, "tests/evals/meal-photo-eval.test.ts"),
      "utf8"
    );
    expect(source).toMatch(/EVAL_MEAL_PHOTO_LIVE\s*===\s*"1"/);
    // And the deliberate npm entry point supplies it.
    const pkg = fs.readFileSync(path.join(ROOT, "package.json"), "utf8");
    expect(pkg).toMatch(/EVAL_MEAL_PHOTO_LIVE=1 vitest run tests\/evals\/meal-photo-eval/);
  });

  it("the exemption list stays honest — no documented var hides in it", () => {
    const docs = fs.readFileSync(
      path.join(ROOT, "docs/ops/env-reference.md"),
      "utf8"
    );
    for (const name of EXEMPT) {
      expect(
        docs.includes(`\`${name}\``),
        `${name} is documented in env-reference.md — remove it from the exemption list`
      ).toBe(false);
    }
  });
});
