import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CLINICAL_ROUTES, classifyClinicalRisk } from "../../../lib/pal/clinical-risk";
import { checkFood } from "../../../lib/pal/service";

const ROOT = process.cwd();
const throwingModel = {
  generate: () => {
    throw new Error("The model must never be called on a clinical route.");
  }
};

describe("the pregnancy route stays on (PRD §9.3; S2 is the safety owner's, not the plan's)", () => {
  it("the order is the policy: four routes outrank pregnancy, and it is fifth", () => {
    expect(CLINICAL_ROUTES.slice(0, 5)).toEqual([
      "urgent_symptoms",
      "possible_hypoglycemia",
      "medication_dosing",
      "eating_disorder",
      "pregnancy"
    ]);
  });

  // One probe per pattern in ROUTE_PATTERNS.pregnancy — the route stays whole.
  it.each([
    "is sushi ok in pregnancy",
    "im preggers and craving cake",
    "gestational diabetes, is rice ok",
    "i have gdm, is oatmeal ok",
    "we are expecting a baby, is brie ok",
    "im 28 weeks pregnant, pasta for dinner",
    "breastfeeding, is coffee alright",
    "nursing my baby, can i have tuna",
    "trying to conceive, is soy ok"
  ])("fires on: %s", (text) => {
    expect(classifyClinicalRisk(text)?.route).toBe("pregnancy");
  });

  it.each(["pregame snacks and wings", "chicken and rice with broccoli"])("does not fire on: %s", (text) => {
    expect(classifyClinicalRisk(text)).toBeNull();
  });

  it.each([
    ["im pregnant and have been vomiting all morning", "urgent_symptoms"],
    ["gestational diabetes and my blood sugar is 48", "possible_hypoglycemia"],
    ["im pregnant, how much insulin for this pasta", "medication_dosing"],
    ["pregnant and i make myself throw up after meals", "eating_disorder"]
  ] as const)("the four routes above it still win: %s", (text, route) => {
    expect(classifyClinicalRisk(text)?.route).toBe(route);
  });

  it.each([6.0, 5.2, 7.1])("the engine refuses pregnancy input with no model call at A1C %s", async (a1c) => {
    const response = await checkFood({ food: "im 30 weeks pregnant, chicken and rice", a1c }, { model: throwingModel });
    expect(JSON.stringify(response)).toContain("pregnancy");
  });

  it("the engine's one entry point runs the clinical router before anything else", () => {
    const service = fs.readFileSync(path.join(ROOT, "lib/pal/service.ts"), "utf8");
    const router = service.indexOf("classifyClinicalRisk(request.food)");
    expect(router).toBeGreaterThan(-1);
    expect(router).toBeLessThan(service.indexOf("routeA1C(request.a1c)"));
  });

  it("no GDM file reaches the prediabetes engine, its labels, its A1C router or its boundary copy", () => {
    const offenders: string[] = [];
    for (const dir of ["app/gdm", "app/api/gdm", "components/gdm", "lib/pal/gdm"]) {
      for (const rel of walk(dir)) {
        const source = fs.readFileSync(path.join(ROOT, rel), "utf8");
        if (/from\s+["'][^"']*\/pal\/(?:service|labels|a1c|boundary-copy|prompt)["']/.test(source)) offenders.push(rel);
      }
    }
    // Also check lib/server/gdm-*.ts and lib/client/gdm-*.ts (R16)
    for (const dir of ["lib/server", "lib/client"]) {
      for (const rel of walk(dir)) {
        if (/gdm-/.test(rel)) {
          const source = fs.readFileSync(path.join(ROOT, rel), "utf8");
          if (/from\s+["'][^"']*\/pal\/(?:service|labels|a1c|boundary-copy|prompt)["']/.test(source)) offenders.push(rel);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no GDM file filters a clinical route by name (that would be S2 by the back door)", () => {
    const offenders: string[] = [];
    for (const dir of ["app/gdm", "app/api/gdm", "components/gdm", "lib/pal/gdm"]) {
      for (const rel of walk(dir)) {
        if (/["']pregnancy["']/.test(fs.readFileSync(path.join(ROOT, rel), "utf8"))) offenders.push(rel);
      }
    }
    // Also check lib/server/gdm-*.ts and lib/client/gdm-*.ts (R16)
    for (const dir of ["lib/server", "lib/client"]) {
      for (const rel of walk(dir)) {
        if (/gdm-/.test(rel)) {
          if (/["']pregnancy["']/.test(fs.readFileSync(path.join(ROOT, rel), "utf8"))) offenders.push(rel);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

function walk(dir: string, out: string[] = []): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(rel, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(rel);
  }
  return out;
}
