import { describe, it, expect } from "vitest";
import { buildPostingPackage } from "../../../video-engine/export";
import type { VideoSpec } from "../../../video-engine/schema";

const spec = (over: Partial<VideoSpec>): VideoSpec =>
  ({
    id: "vs-x", hook_id: "hk-x", format: "check_demo", spoken_hook: "", visual_hook: "hi",
    beats: [], asset_list: [], caption_text: "Base caption. Comment GUIDE.",
    disclosure_block: "", claims_used: [], duration_s: 20, status: "DRAFT", ...over,
  }) as VideoSpec;

const DISCLAIMER = "Prediabetes Pal is informational only and is not medical advice.";

describe("buildPostingPackage (v1 = master passthrough + compliant caption)", () => {
  it("no claims → caption is unchanged, master path passes through", () => {
    const pkg = buildPostingPackage(spec({}), "/out/vs-x/master.mp4");
    expect(pkg.masterPath).toBe("/out/vs-x/master.mp4");
    expect(pkg.caption).toBe("Base caption. Comment GUIDE.");
  });

  it("claims present → disclosure is mirrored INTO the caption (16 CFR 255 dual-mode)", () => {
    const pkg = buildPostingPackage(
      spec({ claims_used: ["a claim"], disclosure_block: DISCLAIMER }),
      "/out/vs-x/master.mp4",
    );
    expect(pkg.caption).toContain("Base caption. Comment GUIDE.");
    expect(pkg.caption).toContain(DISCLAIMER);
  });
});
