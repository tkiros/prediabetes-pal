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

    // Docker is watched IF AND ONLY IF there is something for it to watch.
    // Dependabot's docker ecosystem reads Dockerfiles, compose files and k8s
    // manifests — PR #80 deleted the last of those (Dockerfile.cron) with the
    // Railway decommission, so a bare `package-ecosystem: docker` entry became
    // config that can only ever produce nothing.
    //
    // Asserting the biconditional rather than dropping the check keeps this
    // honest in both directions: add a Dockerfile back without a Dependabot
    // entry and this goes red, which is the property the original assertion
    // was reaching for. The CI postgres service image stays digest-pinned
    // regardless — that is asserted above, and Dependabot never covered it
    // (workflow `services:` images are outside every ecosystem).
    const dockerFiles = fs
      .readdirSync(".", { recursive: true, encoding: "utf8" })
      .filter(
        (f) =>
          !f.startsWith("node_modules") &&
          !f.startsWith(".git/") &&
          !f.includes("/node_modules/") &&
          /(^|\/)(Dockerfile[^/]*|docker-compose\.ya?ml)$/.test(f)
      );

    expect(dependabot.includes("package-ecosystem: docker")).toBe(
      dockerFiles.length > 0
    );
  });
});
