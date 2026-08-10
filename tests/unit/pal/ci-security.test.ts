import fs from "node:fs";

import { describe, expect, it } from "vitest";

const workflow = fs.readFileSync(".github/workflows/ci.yml", "utf8");

describe("CI supply-chain controls", () => {
  it("pins every action to a full immutable commit", () => {
    const uses = [...workflow.matchAll(/^\s*- uses:\s*([^\s#]+)/gm)].map(
      (match) => match[1]
    );

    expect(uses.length).toBeGreaterThan(0);
    for (const action of uses) {
      expect(action).toMatch(/^[^@]+@[a-f0-9]{40}$/);
    }
  });

  it("uses least-privilege defaults, cancels obsolete runs, and pins services", () => {
    expect(workflow).toMatch(/permissions:\n\s+contents: read/);
    expect(workflow).toMatch(/concurrency:\n[\s\S]*cancel-in-progress: true/);
    expect(workflow).not.toContain("ubuntu-latest");
    expect(workflow).toMatch(/image: postgres:16@sha256:[a-f0-9]{64}/);
  });

  it("does not persist checkout credentials in any job", () => {
    const checkoutCount = (
      workflow.match(/uses: actions\/checkout@/g) ?? []
    ).length;
    const disabledCount = (
      workflow.match(/persist-credentials: false/g) ?? []
    ).length;
    expect(checkoutCount).toBe(4);
    expect(disabledCount).toBe(checkoutCount);
  });

  it("keeps action and dependency pin refreshes automated", () => {
    const dependabot = fs.readFileSync(".github/dependabot.yml", "utf8");
    expect(dependabot).toContain("package-ecosystem: github-actions");
    expect(dependabot).toContain("package-ecosystem: npm");
    expect(dependabot).toContain("package-ecosystem: docker");
  });
});
