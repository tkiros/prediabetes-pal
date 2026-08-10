import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  createPantryVisionClient,
  normalizeItemName
} from "../../lib/pantry/extract";

/**
 * Live extraction-quality gate (design doc locked decision 11):
 *   recall >= 0.70 across all labeled photos, hallucinations == 0.
 * Fixtures are the FOUNDER'S OWN photos with exhaustive labels
 * (labels.json lists every clearly visible food item per photo — an
 * extracted item matching no label counts as a hallucination).
 * Mirrors eval:pal:live gating: runs only with PAL_LIVE_EVAL=1.
 */

const FIXTURES = path.join(process.cwd(), "tests/fixtures/pantry-photos");
const LABELS = path.join(FIXTURES, "labels.json");
const LIVE = process.env.PAL_LIVE_EVAL === "1" && !!process.env.OPENAI_API_KEY;
const READY = LIVE && fs.existsSync(LABELS);

const RECALL_FLOOR = 0.7;

function matches(label: string, extracted: string): boolean {
  const a = normalizeItemName(label);
  const b = normalizeItemName(extracted);
  return a.includes(b) || b.includes(a);
}

describe.skipIf(!READY)("eval:pantry-extract (live)", () => {
  it("meets the recall floor with zero hallucinations", { timeout: 600_000 }, async () => {
    const cases = JSON.parse(fs.readFileSync(LABELS, "utf8")) as {
      file: string;
      items: string[];
    }[];
    expect(cases.length).toBeGreaterThanOrEqual(8);

    const client = createPantryVisionClient();
    let labelsTotal = 0;
    let labelsFound = 0;
    const hallucinations: string[] = [];

    for (const testCase of cases) {
      const image = fs.readFileSync(path.join(FIXTURES, testCase.file));
      const dataUrl = `data:image/jpeg;base64,${image.toString("base64")}`;
      const extracted = await client.extractFromPhoto(dataUrl);

      const found = testCase.items.filter((label) =>
        extracted.some((item) => matches(label, item.name))
      );
      const extra = extracted.filter(
        (item) => !testCase.items.some((label) => matches(label, item.name))
      );

      labelsTotal += testCase.items.length;
      labelsFound += found.length;
      hallucinations.push(...extra.map((item) => `${testCase.file}: ${item.name}`));

      console.log(
        `${testCase.file}: recall ${found.length}/${testCase.items.length}, ` +
          `hallucinations ${extra.length}`
      );
    }

    const recall = labelsFound / labelsTotal;
    console.log(`TOTAL recall=${recall.toFixed(3)} hallucinations=${hallucinations.length}`);
    console.log(hallucinations.join("\n"));

    expect(recall).toBeGreaterThanOrEqual(RECALL_FLOOR);
    expect(hallucinations).toEqual([]);
  });
});

describe.skipIf(READY)("eval:pantry-extract (setup)", () => {
  it("explains what is missing", () => {
    console.log(
      "SETUP_BLOCKED: eval:pantry-extract needs (1) PAL_LIVE_EVAL=1, " +
        "(2) OPENAI_API_KEY, (3) 8-10 founder photos in tests/fixtures/pantry-photos/ " +
        "with an exhaustive labels.json (see labels.example.json). Skipping."
    );
    expect(true).toBe(true);
  });
});
