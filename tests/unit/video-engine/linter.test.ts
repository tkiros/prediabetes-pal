import { describe, it, expect } from "vitest";
import { runRegexChecks } from "../../../video-engine/linter";
import type { VideoSpec } from "../../../video-engine/schema";

function spec(over: Partial<VideoSpec>): VideoSpec {
  return {
    id: "s1", hook_id: "h1", format: "myth_label_trap",
    spoken_hook: "Watch what oatmeal really does", visual_hook: "your healthy breakfast",
    beats: [], asset_list: [], caption_text: "Informational only.",
    disclosure_block: "", claims_used: [], duration_s: 25, status: "DRAFT", ...over,
  } as VideoSpec;
}
const rules = (items: ReturnType<typeof runRegexChecks>) => items.map((i) => i.rule);

describe("runRegexChecks", () => {
  it("hard-fails the reversal family", () => {
    const items = runRegexChecks(spec({ caption_text: "Prediabetes Pal helps reverse prediabetes." }));
    expect(items.some((i) => i.rule === "claim:reversal" && i.severity === "hard_fail")).toBe(true);
  });

  it("hard-fails a future-A1C prediction", () => {
    const items = runRegexChecks(spec({ beats: ["Your A1C will drop to 5.8% this way."] }));
    expect(items.some((i) => i.severity === "hard_fail" && i.rule.startsWith("prediction:"))).toBe(true);
  });

  it("flags — does not hard-fail — bare 'treat'/'prevent'", () => {
    const items = runRegexChecks(spec({ caption_text: "Treat yourself to steel-cut oats to prevent a boring breakfast." }));
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.severity === "flag")).toBe(true);
  });

  it("hard-fails the fear/urgency hook family", () => {
    const items = runRegexChecks(spec({ spoken_hook: "Check this right now before it's too late" }));
    expect(items.some((i) => i.rule.startsWith("hook:") && i.severity === "hard_fail")).toBe(true);
  });

  it("hard-fails the dramatic-results testimonial family", () => {
    const items = runRegexChecks(spec({ spoken_hook: "This fixed my A1C in two weeks" }));
    expect(items.some((i) => i.rule.startsWith("hook:") && i.severity === "hard_fail")).toBe(true);
  });

  it("passes clean, on-brand copy", () => {
    const items = runRegexChecks(spec({
      spoken_hook: "Watch what it says about breakfast",
      visual_hook: "your healthy breakfast",
      caption_text: "This looks more balanced than a fast-carb option. Informational only.",
    }));
    expect(items).toEqual([]);
  });
});
