import { describe, expect, it } from "vitest";

import {
  captureFirstTouchUtm,
  CHANNELS,
  mapUtmSource,
  storedUtmChannel
} from "../../../lib/client/attribution";

function fakeStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    dump: () => Object.fromEntries(map)
  };
}

describe("mapUtmSource — raw strings land on the closed enum, nowhere else", () => {
  it.each([
    ["reddit", "reddit"],
    ["RedditAds", "reddit"],
    ["tiktok", "video"],
    ["ig_reels", "video"],
    ["yt", "video"],
    ["youtube_shorts", "video"],
    ["facebook", "facebook"],
    ["fb", "facebook"],
    ["google", "search"],
    ["friend", "friend"],
    ["newsletter", "other"],
    ["' OR 1=1 --", "other"]
  ] as const)("%s → %s", (raw, expected) => {
    expect(mapUtmSource(raw)).toBe(expected);
  });

  it("absent source is none, and every output is enum-or-none", () => {
    expect(mapUtmSource(null)).toBe("none");
    expect(mapUtmSource("")).toBe("none");
    for (const raw of ["reddit", "zzz", "TIKTOK", "@@@@"]) {
      const mapped = mapUtmSource(raw);
      expect([...CHANNELS, "none"]).toContain(mapped);
    }
  });
});

describe("first-touch capture", () => {
  it("stores the mapped channel from the first UTM-carrying visit", () => {
    const storage = fakeStorage();
    captureFirstTouchUtm("?utm_source=reddit&utm_campaign=w1", storage);
    expect(storedUtmChannel(storage)).toBe("reddit");
    // Only the enum value ever lands in storage — never the raw query.
    expect(Object.values(storage.dump())).toEqual(["reddit"]);
  });

  it("never overwrites the first touch, and ignores UTM-less visits", () => {
    const storage = fakeStorage();
    captureFirstTouchUtm("?utm_source=tiktok", storage);
    captureFirstTouchUtm("?utm_source=reddit", storage);
    captureFirstTouchUtm("", storage);
    expect(storedUtmChannel(storage)).toBe("video");
  });

  it("reads tampered storage as none, not as free text", () => {
    const storage = fakeStorage({ "pal.utm.v1": "<script>alert(1)</script>" });
    expect(storedUtmChannel(storage)).toBe("none");
  });

  it("no-ops without storage", () => {
    expect(() => captureFirstTouchUtm("?utm_source=reddit", null)).not.toThrow();
    expect(storedUtmChannel(null)).toBe("none");
  });
});
