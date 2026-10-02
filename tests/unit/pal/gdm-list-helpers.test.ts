// tests/unit/pal/gdm-list-helpers.test.ts
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { focusIdAfterRemove } from "../../../lib/client/gdm-focus";
import { gdmSaveFailure } from "../../../lib/client/gdm-items-list";
import { GDM_COPY } from "../../../lib/pal/gdm/copy";

const ROOT = process.cwd();
const control = (id: string) => `row-${id}-first`;

describe("the door's shared list helpers (My questions, My meals)", () => {
  it("after a Delete, focus goes to the next entry's first control, the one above for the last, or the fallback once empty (G-39)", () => {
    expect(focusIdAfterRemove(["a", "b", "c"], "a", control, "add")).toBe("row-b-first");
    expect(focusIdAfterRemove(["a", "b", "c"], "b", control, "add")).toBe("row-c-first");
    expect(focusIdAfterRemove(["a", "b", "c"], "c", control, "add")).toBe("row-b-first");
    expect(focusIdAfterRemove(["a"], "a", control, "add")).toBe("add");
    // An id no longer in the list (already gone) still lands somewhere, never on <body>.
    expect(focusIdAfterRemove(["a", "b"], "z", control, "add")).toBe("row-a-first");
    expect(focusIdAfterRemove([], "z", control, "add")).toBe("add");
  });

  it("a full list says so; every other failed save is the save-failed line (G-14)", () => {
    expect(gdmSaveFailure(409)).toBe(GDM_COPY["gdm-list-full"].line);
    for (const status of [0, 400, 403, 404, 500, 502]) expect(gdmSaveFailure(status)).toBe(GDM_COPY["gdm-save-failed"].line);
  });

  it("both lists keep their entries through the one hook and show the one load-failed card — neither loads, saves or deletes on its own", () => {
    for (const file of ["components/gdm/ask-list.tsx", "components/gdm/my-meals.tsx"]) {
      const source = fs.readFileSync(path.join(ROOT, file), "utf8");
      expect(source, file).toMatch(/useGdmItems<\w+>\("(?:ask|meal)"\)/);
      expect(source, file).toContain("<GdmLoadFailed onRetry={retry} />");
      expect(source, file).not.toMatch(/\?kind=|method: "PATCH"|method: "DELETE"|gdm-load-failed/);
    }
  });
});
