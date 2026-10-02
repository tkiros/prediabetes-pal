import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const GDM_DIRS = ["app/gdm", "app/api/gdm", "components/gdm", "lib/pal/gdm"];

/** R16: also cover the door's own helper files under these two directories. */
function gdmHelperFiles(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs)
    .filter((name) => name.startsWith("gdm-") && /\.tsx?$/.test(name))
    .map((name) => path.join(dir, name));
}

function sources(): Array<{ rel: string; text: string }> {
  const out: Array<{ rel: string; text: string }> = [];
  const visit = (rel: string) => {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) return;
    if (fs.statSync(abs).isDirectory()) fs.readdirSync(abs).forEach((name) => visit(path.join(rel, name)));
    else if (/\.tsx?$/.test(rel)) out.push({ rel, text: fs.readFileSync(abs, "utf8") });
  };
  GDM_DIRS.forEach(visit);
  for (const rel of [...gdmHelperFiles("lib/server"), ...gdmHelperFiles("lib/client")]) {
    out.push({ rel, text: fs.readFileSync(path.join(ROOT, rel), "utf8") });
  }
  return out;
}

describe("the GDM door asks no A1C and has no medication field (PRD §7.1, §7.2, D2)", () => {
  it("found the door's sources", () => {
    expect(sources().length).toBeGreaterThan(3);
  });

  it("no GDM source names an A1C, in code or in comments", () => {
    expect(sources().filter(({ text }) => /a1c/i.test(text)).map(({ rel }) => rel)).toEqual([]);
  });

  it("no GDM source declares a medication-shaped field, input or schema key", () => {
    const FIELD = /\b(?:medication|medicine|meds|insulin|metformin|dose|dosage)\w*\s*[:=?]/i;
    expect(sources().filter(({ text }) => FIELD.test(text)).map(({ rel }) => rel)).toEqual([]);
  });

  it("no GDM surface links or hands off to a prediabetes-door route (PRD §7.1: /check is not reachable from this profile)", () => {
    const LINK = /["'`]\/(?:check|home|onboarding|welcome|journey|meals|learn|subscribe|trial)(?:["'`/?#])/;
    expect(sources().filter(({ text }) => LINK.test(text)).map(({ rel }) => rel)).toEqual([]);
  });
});
