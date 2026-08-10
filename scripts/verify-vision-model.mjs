#!/usr/bin/env node
// Build-time check that the configured vision model accepts image input.
// Usage: OPENAI_API_KEY=... node scripts/verify-vision-model.mjs
// On failure: set PAL_VISION_MODEL to a vision-capable sibling — it is
// used ONLY for extraction; the judge model is untouched (locked decision 1).
import OpenAI from "openai";

const model = process.env.PAL_VISION_MODEL ?? "gpt-5.4-mini";
if (!process.env.OPENAI_API_KEY) {
  console.log("SETUP_BLOCKED: export OPENAI_API_KEY and rerun.");
  process.exit(0);
}

// 1x1 white PNG.
const pixel =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";

const client = new OpenAI({ timeout: 30_000, maxRetries: 0 });
try {
  await client.responses.create({
    model,
    store: false,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: "Reply with the single word: ok" },
          { type: "input_image", image_url: pixel, detail: "low" }
        ]
      }
    ]
  });
  console.log(`OK: ${model} accepts image input.`);
} catch (error) {
  console.error(`FAIL: ${model} rejected image input: ${error.message}`);
  console.error(
    "Set PAL_VISION_MODEL to a vision-capable sibling (extraction only) and rerun."
  );
  process.exit(1);
}
