import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The workflow is plain text to this test on purpose: the two traps it guards
// (CLAUDE.md "Rename lockstep traps"; owner execution plan 2026-09-06 Phase 1)
// are byte-level, and a YAML parser would hide exactly the drift we care about.
const workflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/hourly-crons.yml"),
  "utf8"
);
const runner = readFileSync(
  resolve(process.cwd(), "scripts/run-hourly-crons.mjs"),
  "utf8"
);

describe("hourly-crons workflow", () => {
  it("pins every APP_URL to CANONICAL_APP_URL byte-for-byte (invalid_app_url trap)", () => {
    const canonical = runner.match(/CANONICAL_APP_URL = "([^"]+)"/)?.[1];
    expect(canonical).toBeTruthy();
    const pinned = [...workflow.matchAll(/^\s*APP_URL:\s*(\S+)\s*$/gm)].map((m) => m[1]);
    expect(pinned.length).toBeGreaterThan(0);
    for (const url of pinned) {
      expect(url).toBe(canonical);
    }
  });

  it("pings the heartbeat on success and <url>/fail on failure, both gated on the secret", () => {
    expect(workflow).toMatch(/CRON_HEARTBEAT_URL: \$\{\{ secrets\.CRON_HEARTBEAT_URL \}\}/);
    expect(workflow).toMatch(/if: success\(\) && env\.CRON_HEARTBEAT_URL != ''/);
    expect(workflow).toMatch(/if: failure\(\) && env\.CRON_HEARTBEAT_URL != ''/);
    expect(workflow).toMatch(/"\$CRON_HEARTBEAT_URL\/fail"/);
    // The failure ping must carry the run URL so the page links straight to the log.
    expect(workflow).toMatch(/actions\/runs\/\$\{\{ github\.run_id \}\}/);
  });
});
