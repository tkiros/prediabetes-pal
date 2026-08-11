/**
 * Capture live product outputs for PHOTO cases: staged image → vision draft
 * (photo-draft path) → composeDraftText → checkFood, i.e. the same chain the
 * app runs when a user snaps a meal photo.
 *
 * Works off a photo manifest (see photo-intake-checklist.md). Tier 1
 * (web-sourced engineering) manifests live OUTSIDE the repo and their
 * captures are engineering evidence only; Tier 2 (consent-clean) captures
 * are panel-eligible. The tier is stamped into the output from the manifest.
 *
 * Usage: PAL_LIVE_EVAL=1 OPENAI_API_KEY=... [OPENAI_BASE_URL=...] \
 *        PAL_MODEL=... PAL_VISION_MODEL=... \
 *        npx tsx scripts/dietitian-panel/capture-photo-outputs.mts \
 *          <out.json> <photos-manifest.json>
 */
import fs from "node:fs";

import { composeDraftText } from "../../lib/client/photo-draft";
import { createMealVisionClient } from "../../lib/meal/photo-extract";
import { checkFood } from "../../lib/pal/service";
import { createEvalModelClient } from "../../tests/support/pal-test-model";

const out = process.argv[2];
const manifestPath = process.argv[3];
if (!out || !manifestPath) {
  throw new Error("usage: capture-photo-outputs.mts <out.json> <manifest.json>");
}

type ManifestRow = {
  id: string;
  file: string;
  staged?: string;
  bucket: string;
  consent: string;
  a1c: number;
  notes: string;
};
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
  tier: number;
  disclaimer?: string;
  rows: ManifestRow[];
};

const vision = createMealVisionClient();
const model = createEvalModelClient([]);

const rows: unknown[] = [];
for (const row of manifest.rows) {
  const imagePath = row.staged ?? row.file;
  const dataUrl = `data:image/jpeg;base64,${fs.readFileSync(imagePath).toString("base64")}`;

  let draft: { dish: string | null; items: { name: string; portion: string | null; uncertain: boolean }[] } | null = null;
  let draftText: string | null = null;
  let response: unknown = null;
  let error: string | null = null;

  // Same fail-closed posture as the product: one retry on provider blips.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      draft ??= await vision.draftFromPhoto(dataUrl);
      draftText = composeDraftText(draft.dish, draft.items);
      if (!draftText) {
        error = "vision draft produced empty text";
        break;
      }
      response = await checkFood({ food: draftText, a1c: row.a1c }, { model });
      error = null;
      if ((response as { kind?: string }).kind !== "retry") break;
    } catch (e) {
      error = String(e);
    }
    await new Promise((r) => setTimeout(r, 4000));
  }

  rows.push({
    id: row.id,
    category: "photo",
    stratum: `photo_${row.bucket}`,
    probe: null,
    input: { food: draftText ?? "(vision draft failed)", a1c: row.a1c },
    photo: { file: row.file, consent: row.consent, draft },
    harmfulIfSafe: null,
    acceptableRisks: null,
    labelSource: null,
    notes: row.notes,
    response,
    error
  });
  console.log(
    `${row.id}: draft="${draftText ?? "-"}" -> ${(response as { kind?: string })?.kind ?? "ERROR"}/${(response as { risk?: string })?.risk ?? "-"}`
  );
}

fs.writeFileSync(
  out,
  JSON.stringify(
    {
      model: process.env.PAL_MODEL,
      visionModel: process.env.PAL_VISION_MODEL ?? null,
      tier: manifest.tier,
      disclaimer: manifest.disclaimer ?? null,
      capturedAt: new Date().toISOString(),
      rows
    },
    null,
    2
  )
);
console.log(`wrote ${out} (${rows.length} photo cases)`);
