import type { CheckRequest } from "../pal/schemas";

export type CheckFormInput = {
  food: string;
  a1c: string;
};

export type CheckFormIssue = {
  field: "food" | "a1c";
  message: string;
};

export function validateCheckForm(
  input: CheckFormInput
): { ok: true; data: CheckRequest } | { ok: false; issues: CheckFormIssue[] } {
  const food = input.food.trim();
  const a1c = input.a1c.trim();
  const issues: CheckFormIssue[] = [];

  if (food.length === 0) {
    issues.push({ field: "food", message: "Enter a food or meal." });
  }

  if (a1c.length === 0) {
    issues.push({ field: "a1c", message: "Enter your A1C with one decimal." });
  } else if (/[^\d.]/.test(a1c)) {
    issues.push({ field: "a1c", message: "Use numbers only, like 6.1." });
  } else if ((a1c.match(/\./g) ?? []).length !== 1 || !/^\d+\.\d$/.test(a1c)) {
    issues.push({ field: "a1c", message: "Use one decimal place, like 6.1." });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    data: {
      food,
      a1c: Number(a1c)
    }
  };
}
