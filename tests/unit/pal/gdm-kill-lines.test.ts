import fs from "node:fs";

import { describe, expect, it } from "vitest";

const doc = fs.readFileSync("docs/ops/launch-controls.md", "utf8");
// Whitespace-normalised, so a sentence that wraps across lines in the doc still matches.
const section = doc.slice(doc.indexOf("## 14. The GDM door's reads")).replace(/\s+/g, " ");
const analytics = fs.readFileSync("lib/client/analytics.ts", "utf8");

describe("PRD §9.2 kill lines are wired, not described", () => {
  it("§14 exists", () => {
    expect(doc).toContain("## 14. The GDM door's reads");
  });

  it("every event §14 names is a real, allowlisted analytics event", () => {
    const named = [...new Set(section.match(/`gdm_[a-z_]+`/g) ?? [])].map((token) => token.slice(1, -1));
    const tables = ["gdm_profiles", "gdm_items"];
    const events = named.filter((name) => !tables.includes(name));
    expect(events.length).toBeGreaterThanOrEqual(6);
    for (const name of events) expect(analytics, name).toContain(`name: "${name}"`);
  });

  // A line's own subsection: from its "### 14.x" heading to the next one.
  const subsection = (heading: string): string => {
    const start = section.indexOf(heading);
    if (start === -1) return "";
    const next = section.indexOf("### 14.", start + heading.length);
    return section.slice(start, next === -1 ? undefined : next);
  };

  it.each([
    ["KL-T1", "### 14.1"],
    ["D7", "### 14.2"],
    ["KL-D1", "### 14.3"]
  ])("%s has a numerator, a denominator and the 50-user floor", (_line, heading) => {
    const body = subsection(heading);
    expect(body).toMatch(/Numerator/);
    expect(body).toMatch(/Denominator/);
    expect(body).toMatch(/50 door users/);
  });

  it("measures no health outcome", () => {
    expect(section).toMatch(/Nothing here measures glucose, weight, medication, delivery or any pregnancy outcome, and nothing will\./);
  });

  // Review amendments from the brief
  it("G-02: Unread is a finding too", () => {
    expect(subsection("### 14.1")).toMatch(/Unread is a finding too/);
  });

  it("G-57: exact floor for A", () => {
    expect(subsection("### 14.1")).toMatch(/exact floor for A/);
  });

  it("G-04, G-18: sign-up funnel", () => {
    expect(subsection("### 14.4")).toMatch(/sign-up funnel/);
  });
});
