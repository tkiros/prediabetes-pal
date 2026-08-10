import { describe, it, expect } from "vitest";
import { lintSpec } from "../../../video-engine/agents";
import type { VideoSpec } from "../../../video-engine/schema";

const spec = (over: Partial<VideoSpec>): VideoSpec => ({
  id: "s1", hook_id: "h1", format: "myth_label_trap", spoken_hook: "Watch this", visual_hook: "healthy breakfast",
  beats: [], asset_list: [], caption_text: "Informational only.", disclosure_block: "",
  claims_used: [], duration_s: 25, status: "DRAFT", ...over,
});

describe("lintSpec", () => {
  it("merges regex + LLM items and reports pass on clean copy with an empty LLM layer", async () => {
    const rep = await lintSpec(spec({}), { runner: async () => '{"items":[]}' });
    expect(rep.verdict).toBe("pass");
    expect(rep.spec_id).toBe("s1");
  });

  it("hard-fails from the regex layer even if the LLM layer says clean", async () => {
    const rep = await lintSpec(spec({ caption_text: "Prediabetes Pal reverses prediabetes." }), { runner: async () => '{"items":[]}' });
    expect(rep.verdict).toBe("hard_fail");
    expect(rep.items.some((i) => i.rule === "claim:reversal")).toBe(true);
  });

  it("degrades to regex-only if the LLM layer errors", async () => {
    const rep = await lintSpec(spec({}), { runner: async () => { throw new Error("cli down"); } });
    expect(rep.verdict).toBe("pass"); // regex found nothing; LLM failure is swallowed
  });
});
