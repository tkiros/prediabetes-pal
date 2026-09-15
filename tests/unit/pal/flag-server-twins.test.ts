import { afterEach, describe, expect, it, vi } from "vitest";

import { GUIDE_SURFACES, SURFACE_REQUIRES, SURFACE_ROWS } from "../../../lib/guide-door-flag";
import { IDEA_LABEL_BANDS, checkProductionDoor } from "../../../lib/guide-door-guard";
import {
  longitudinalInsightsServerEnabled
} from "../../../lib/longitudinal-insights-flag";
import { GUIDE_IDEAS } from "../../../lib/pal/guide-ideas";
import { PROMPT_VERSION } from "../../../lib/pal/prompt";
import { photoInputServerEnabled } from "../../../lib/photo-input-flag";
import { LABEL_BANDS, buildLabelsFile, type GuideIdeaLabels } from "../../support/guide-ideas-label-eval";

/**
 * Server twins for the two formerly build-time-only flags (C7 residuals,
 * outside-voice #8). Fail-closed: only the exact value "1" enables; the env is
 * injectable so nothing here mutates process.env.
 */
describe("flag server twins", () => {
  it("photoInputServerEnabled: only exact '1' enables", () => {
    expect(photoInputServerEnabled({ PHOTO_INPUT_ENABLED: "1" })).toBe(true);
    expect(photoInputServerEnabled({ PHOTO_INPUT_ENABLED: "true" })).toBe(false);
    expect(photoInputServerEnabled({ PHOTO_INPUT_ENABLED: "0" })).toBe(false);
    expect(photoInputServerEnabled({ PHOTO_INPUT_ENABLED: "" })).toBe(false);
    expect(photoInputServerEnabled({})).toBe(false);
  });

  it("longitudinalInsightsServerEnabled: only exact '1' enables", () => {
    expect(
      longitudinalInsightsServerEnabled({ LONGITUDINAL_INSIGHTS_ENABLED: "1" })
    ).toBe(true);
    expect(
      longitudinalInsightsServerEnabled({
        LONGITUDINAL_INSIGHTS_ENABLED: "true"
      })
    ).toBe(false);
    expect(
      longitudinalInsightsServerEnabled({ LONGITUDINAL_INSIGHTS_ENABLED: "" })
    ).toBe(false);
    expect(longitudinalInsightsServerEnabled({})).toBe(false);
  });
});

/**
 * Task 1.11 — the production door guard (A-63, A-94, A-100, A-101, A-119).
 * NEXT_PUBLIC_GUIDE_DOOR has no server twin on purpose; what it has instead is
 * a build-time guard that ties the production value to the copy ledger. The
 * guard is pure — the ledger text, the labels file, PROMPT_VERSION and the
 * model id are passed in — so every rule is pinned here without fs or env.
 */
const LEDGER_HEADER = [
  "| Copy ID | Surface | Status | Active | Allowed Claim Class | Copy | Evidence Rows | Notes |",
  "| --- | --- | --- | --- | --- | --- | --- | --- |"
];

function ledgerRow(id: string, status: string, active = "Yes"): string {
  return `| \`${id}\` | Product | ${status} | ${active} | \`product-role\` | Some copy. | FTC-HEALTH-COMPLIANCE | Fixture. |`;
}

/** A ledger in the real table shape, every listed row at `status`. */
function ledgerWith(ids: readonly string[], status = "Approved", extraRows: readonly string[] = []): string {
  return [
    "# Copy Ledger",
    "",
    "## Ledger",
    "",
    ...LEDGER_HEADER,
    ...ids.map((id) => ledgerRow(id, status)),
    ...extraRows,
    ""
  ].join("\n");
}

const MODEL = "gpt-5.4-mini";

/** A coherent labels file built FROM the bank, so the fixture never drifts from it. */
function freshLabels(): GuideIdeaLabels {
  return buildLabelsFile({
    promptVersion: PROMPT_VERSION,
    model: MODEL,
    ideas: GUIDE_IDEAS,
    cells: Object.fromEntries(
      GUIDE_IDEAS.map((idea) => [
        idea.id,
        Object.fromEntries(LABEL_BANDS.map(({ band }) => [band, { risk: "SAFE", reason: "Balanced." }]))
      ])
    )
  });
}

const ALL_ROWS = GUIDE_SURFACES.flatMap((surface) => SURFACE_ROWS[surface]);

describe("production door guard — checkProductionDoor (Task 1.11)", () => {
  it("never `1` in production (A-94)", () => {
    const result = checkProductionDoor("1", ledgerWith(ALL_ROWS), freshLabels(), PROMPT_VERSION, MODEL);
    expect(result.errors).toEqual([
      'NEXT_PUBLIC_GUIDE_DOOR is "1" in production — list the surfaces whose rows are Approved instead'
    ]);
    expect(result.effective).toBe("");
  });

  it("refuses an unknown surface, naming the ones it knows", () => {
    const result = checkProductionDoor("source,idea", ledgerWith(ALL_ROWS), freshLabels(), PROMPT_VERSION, MODEL);
    expect(result.errors).toEqual([`unknown surface "idea" — one of: ${GUIDE_SURFACES.join(", ")}`]);
    expect(result.effective).toBe("");
  });

  it("refuses a list missing a surface another one requires (A-101)", () => {
    const home = checkProductionDoor("home", ledgerWith(ALL_ROWS), freshLabels(), PROMPT_VERSION, MODEL);
    expect(home.errors).toEqual(['surface "home" requires "ideas", "ideas-full" — add them or remove "home"']);

    const intake = checkProductionDoor("intake,ideas", ledgerWith(ALL_ROWS), freshLabels(), PROMPT_VERSION, MODEL);
    expect(intake.errors).toEqual(['surface "intake" requires "orient" — add it or remove "intake"']);
  });

  it("refuses a surface whose ledger rows are not all Approved — Pending or missing", () => {
    const rows = SURFACE_ROWS.ideas.filter((id) => id !== "guide-ideas-hero" && id !== "check-from-idea");
    const ledger = ledgerWith(rows, "Approved", [ledgerRow("guide-ideas-hero", "Pending")]);
    const result = checkProductionDoor("ideas", ledger, freshLabels(), PROMPT_VERSION, MODEL);
    expect(result.errors).toEqual([
      'surface "ideas" renders row "guide-ideas-hero" whose Status is Pending — get it Approved or remove "ideas"',
      'surface "ideas" renders row "check-from-idea" which is not in the copy ledger — file it, get it Approved, or remove "ideas"'
    ]);
    expect(result.effective).toBe("");
  });

  it("refuses a gated surface that has no ledger rows yet — only `calm` renders none", () => {
    expect(SURFACE_ROWS.calm).toEqual([]);
    for (const surface of ["numbers", "refer", "doctor", "plan", "guide"] as const) {
      expect(SURFACE_ROWS[surface]).toEqual([]);
      const result = checkProductionDoor(surface, ledgerWith(ALL_ROWS), freshLabels(), PROMPT_VERSION, MODEL);
      expect(result.errors).toEqual([`surface "${surface}" has no ledger rows yet — remove it`]);
    }
  });

  it("passes an all-Approved, coherent list with `effective` equal to the input", () => {
    const value = "ideas,ideas-full,home,source,calm,orient,intake";
    const result = checkProductionDoor(value, ledgerWith(ALL_ROWS), freshLabels(), PROMPT_VERSION, MODEL);
    expect(result).toEqual({ effective: value, errors: [], warnings: [] });
  });

  it("the merge-day value — the flag unset — opens nothing, throws nothing, warns nothing", () => {
    // What production actually carries the day this branch merges. Read with
    // no labels file on purpose: even stale labels must not produce a warning
    // when no ideas surface is listed, and nothing here may fail a build.
    const ledger = ledgerWith(ALL_ROWS);
    for (const value of [undefined, "", "   "]) {
      expect(checkProductionDoor(value, ledger, null, PROMPT_VERSION, MODEL), String(value)).toEqual({
        effective: "",
        errors: [],
        warnings: []
      });
    }
  });

  it("maps each surface to the rows A-101 / A-119 name, and the requirements between them", () => {
    expect(SURFACE_ROWS.ideas).toEqual([
      "guide-ideas-breakfast",
      "guide-ideas-lunch",
      "guide-ideas-dinner",
      "guide-ideas-hero",
      "check-empty-ideas",
      "check-from-idea",
      "check-classics-hint-guide"
    ]);
    expect(SURFACE_ROWS.source).toEqual(["result-source-lead"]);
    expect(SURFACE_ROWS["ideas-full"]).toEqual(["guide-ideas-see-all"]);
    expect(SURFACE_REQUIRES).toEqual({
      home: ["ideas", "ideas-full"],
      orient: ["ideas"],
      intake: ["orient"],
      "ideas-full": ["ideas"]
    });
    for (const surface of GUIDE_SURFACES)
      for (const row of SURFACE_ROWS[surface]) expect(row, `${surface} lists a wildcard`).toMatch(/^[a-z0-9-]+$/);
    // The guard checks the same bands the eval writes.
    expect(IDEA_LABEL_BANDS).toEqual(LABEL_BANDS.map(({ band }) => band));
  });

  describe("a ledger row must be Active as well as Approved (fix wave 1, F3)", () => {
    // The ledger's `Active` column says "whether the row is part of the
    // current MVP surface" (docs/safety/copy-ledger.md). `Approved | No` is a
    // real, shipping state — keep-most-09, keep-most-10 and
    // landing-audience-pains all carry it — so Status alone let a surface open
    // in production while rendering copy the ledger says is on no surface.
    const row = SURFACE_ROWS.source[0]!;
    const check = (ledger: string) =>
      checkProductionDoor("source", ledger, freshLabels(), PROMPT_VERSION, MODEL);
    const open = { effective: "source", errors: [], warnings: [] };

    it("`Approved | Yes` passes", () => {
      expect(check(ledgerWith([row]))).toEqual(open);
    });

    it("`Approved | No` errors — a retired row opens nothing", () => {
      const result = check(ledgerWith([], "Approved", [ledgerRow(row, "Approved", "No")]));

      expect(result.errors).toEqual([
        `surface "source" renders row "${row}" whose Active is No (retired) — ` +
          'reactivate the row or remove "source"'
      ]);
      expect(result.effective).toBe("");
    });

    it("`Pending | Yes` still errors on Status, naming that half only", () => {
      const result = check(ledgerWith([], "Approved", [ledgerRow(row, "Pending", "Yes")]));

      expect(result.errors).toEqual([
        `surface "source" renders row "${row}" whose Status is Pending — ` +
          'get it Approved or remove "source"'
      ]);
    });

    it("a table with no `Active` column reads Active — absence is not retirement", () => {
      const ledger = [
        "| Copy ID | Surface | Status | Copy |",
        "| --- | --- | --- | --- |",
        `| \`${row}\` | Result | Approved | Some copy. |`,
        ""
      ].join("\n");

      expect(check(ledger)).toEqual(open);
    });

    it("an empty `Active` cell in a table that HAS the column does not pass", () => {
      const result = check(ledgerWith([], "Approved", [ledgerRow(row, "Approved", "")]));

      expect(result.errors).toEqual([
        `surface "source" renders row "${row}" whose Active is empty (retired) — ` +
          'reactivate the row or remove "source"'
      ]);
    });
  });

  describe("stale idea labels close the ideas surfaces with a warning, never an error (A-100)", () => {
    const value = "ideas,ideas-full,source";
    const ledger = ledgerWith(ALL_ROWS);
    const dropped = { effective: "source", errors: [] };
    const tail = '— "ideas" and "ideas-full" dropped from this build; run npm run eval:pal:ideas';

    it("a prompt bump", () => {
      const result = checkProductionDoor(value, ledger, freshLabels(), "2099-01-01.1", MODEL);
      expect(result).toMatchObject(dropped);
      expect(result.warnings).toEqual([`idea labels are stale (prompt 2099-01-01.1 ≠ ${PROMPT_VERSION}) ${tail}`]);
    });

    it("a model change — the provider prefix is stripped before comparing (A-117)", () => {
      expect(checkProductionDoor(value, ledger, freshLabels(), PROMPT_VERSION, `openai/${MODEL}`)).toEqual({
        effective: value,
        errors: [],
        warnings: []
      });

      const result = checkProductionDoor(value, ledger, freshLabels(), PROMPT_VERSION, "openai/gpt-5.4");
      expect(result).toMatchObject(dropped);
      expect(result.warnings).toEqual([`idea labels are stale (model gpt-5.4 ≠ ${MODEL}) ${tail}`]);
    });

    it("a missing labels file", () => {
      const result = checkProductionDoor(value, ledger, null, PROMPT_VERSION, MODEL);
      expect(result).toMatchObject(dropped);
      expect(result.warnings).toEqual([`idea labels are stale (no readable lib/pal/guide-ideas.labels.json) ${tail}`]);
    });

    it("a bank line whose text drifted, an idea with no label, or a label that is not SAFE", () => {
      const [first, second, third] = GUIDE_IDEAS;
      const labels = freshLabels();
      labels.labels[first.id].text = `${first.text} with toast`;
      delete labels.labels[second.id];
      labels.labels[third.id].prediabetes_63_64 = { risk: "MODERATE", reason: "Fruit." };

      const result = checkProductionDoor(value, ledger, labels, PROMPT_VERSION, MODEL);
      expect(result).toMatchObject(dropped);
      expect(result.warnings).toEqual([
        `idea labels are stale (idea "${first.id}" text changed since the eval, or idea "${second.id}" has no label, or idea "${third.id}" is MODERATE at prediabetes_63_64) ${tail}`
      ]);
    });

    it("also closes every surface that requires a dropped one, transitively, and names each (fix round 1)", () => {
      // home and orient require ideas; intake requires orient. Labels go stale
      // on every PROMPT_VERSION bump — a hotfix must not ship them half-open.
      const probe = checkProductionDoor(
        "ideas,ideas-full,home,orient,intake",
        ledger,
        freshLabels(),
        "2099-01-01.1",
        MODEL
      );
      expect(probe).toEqual({
        effective: "",
        errors: [],
        warnings: [
          `idea labels are stale (prompt 2099-01-01.1 ≠ ${PROMPT_VERSION}) — "ideas", "ideas-full", "home", "orient", "intake" dropped from this build; run npm run eval:pal:ideas`
        ]
      });

      // Surfaces that need nothing from ideas survive, in input order.
      const survivors = checkProductionDoor("source,ideas,orient,calm,intake", ledger, null, PROMPT_VERSION, MODEL);
      expect(survivors).toEqual({
        effective: "source,calm",
        errors: [],
        warnings: [
          'idea labels are stale (no readable lib/pal/guide-ideas.labels.json) — "ideas", "ideas-full", "orient", "intake" dropped from this build; run npm run eval:pal:ideas'
        ]
      });
    });

    it("reads the labels only when the list opens an ideas surface", () => {
      expect(checkProductionDoor("source", ledger, null, "2099-01-01.1", MODEL)).toEqual({
        effective: "source",
        errors: [],
        warnings: []
      });
    });
  });
});

/**
 * The wiring: next.config.ts runs the guard only when VERCEL_ENV is
 * "production" and inlines the EFFECTIVE value through `env`, which Next
 * spreads after the ambient NEXT_PUBLIC_* values (define-env.js) — so a
 * dropped surface reads "off" in every bundle, /api/health's guideDoor too.
 */
describe("next.config.ts door guard wiring (Task 1.11)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function loadConfig(env: Record<string, string>) {
    vi.stubEnv("PAL_ALLOW_NO_MEASUREMENT", "1");
    for (const flag of [
      "NEXT_PUBLIC_PHOTO_INPUT",
      "NEXT_PUBLIC_LONGITUDINAL_INSIGHTS",
      "NEXT_PUBLIC_MEAL_MEMORY",
      "NEXT_PUBLIC_LEARNING_JOURNEY"
    ])
      vi.stubEnv(flag, "");
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    vi.resetModules();
    return (await import("../../../next.config")).default;
  }

  it("passes the value through untouched outside production", async () => {
    const config = await loadConfig({ VERCEL_ENV: "preview", NEXT_PUBLIC_GUIDE_DOOR: "1" });
    expect(config.env).not.toHaveProperty("NEXT_PUBLIC_GUIDE_DOOR");
  });

  it("throws on a guard error in production, with the fix in the message", async () => {
    await expect(loadConfig({ VERCEL_ENV: "production", NEXT_PUBLIC_GUIDE_DOOR: "1" })).rejects.toThrow(
      'NEXT_PUBLIC_GUIDE_DOOR is "1" in production — list the surfaces whose rows are Approved instead'
    );
  });

  it("inlines the effective value in production", async () => {
    const config = await loadConfig({ VERCEL_ENV: "production", NEXT_PUBLIC_GUIDE_DOOR: "calm" });
    expect(config.env).toMatchObject({ NEXT_PUBLIC_GUIDE_DOOR: "calm" });
  });
});
