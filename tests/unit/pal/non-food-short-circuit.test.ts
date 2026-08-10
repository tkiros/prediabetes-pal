import { describe, expect, it, vi } from "vitest";

import { checkFood } from "../../../lib/pal/service";

const ORDINARY_OBJECT_INPUTS = [
  "running shoes",
  "laptop charger",
  "dish soap",
  "water bottle",
  "phone case"
] as const;

describe("checkFood ordinary non-food short-circuit", () => {
  it.each(ORDINARY_OBJECT_INPUTS)(
    "returns not_food for %s without calling the model",
    async (food) => {
      const model = {
        generate: vi.fn()
      };

      const response = await checkFood(
        {
          food,
          a1c: 6.1
        },
        { model }
      );

      expect(response.kind).toBe("not_food");
      expect(model.generate).not.toHaveBeenCalled();

      if (response.kind !== "not_food") {
        throw new Error("Expected a not_food response.");
      }

      expect(response.examples.length).toBeGreaterThanOrEqual(3);
    }
  );
});
