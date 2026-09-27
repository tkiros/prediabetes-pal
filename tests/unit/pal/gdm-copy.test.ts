// tests/unit/pal/gdm-copy.test.ts
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import ts from "typescript";

import { GDM_SURFACE_ROWS } from "../../../lib/gdm-door-flag";
import { GDM_COPY } from "../../../lib/pal/gdm/copy";
import { getCopyLedgerRows } from "../../../scripts/validate-safety-contract.mjs";

const ROOT = process.cwd();

/** A bank is Copy ID → named strings; the ledger sees them in declaration order. */
const toRows = (bank: Record<string, Record<string, string>>): Record<string, readonly string[]> =>
  Object.fromEntries(Object.entries(bank).map(([id, row]) => [id, Object.values(row)]));

/** Every bank of product-authored GDM strings. Tier 2 tasks append theirs (G1.1, G2.1, G3.2). */
const GDM_BANKS: Array<{ name: string; rows: Record<string, readonly string[]> }> = [
  { name: "lib/pal/gdm/copy.ts", rows: toRows(GDM_COPY) }
];

type Family = { label: string; pattern: RegExp; exemptRows?: string[] };

// PRD §8 rule 1, F-CALM-GDM (§6.2), §8 rules 4–5, §7.2. Each family has a control below.
const FAMILIES: Family[] = [
  { label: "banned-string-safe", pattern: /safe/i },
  { label: "banned-string-for-your-baby", pattern: /for\s+your\s+baby/i },
  {
    label: "grading-word",
    pattern:
      /\b(?:good|bad|cheat(?:ed|ing|s)?|fail(?:ed|ing|s|ure)?|slip(?:ped|s)?|earn(?:ed|s)?|deserv(?:e|ed|es)|behav(?:e|ed|es|ing))\b/i
  },
  { label: "blame-grammar", pattern: /\byou\s+(?:went\s+over|overate|ate\s+too\s+much|should(?:\s+not|n't)?\s+have)\b/i },
  { label: "gamification", pattern: /\b(?:streaks?|scores?|badges?|points|level\s+up)\b/i },
  {
    label: "medication-word",
    pattern:
      /\b(?:insulin|metformin|glyburide|medication|medicines?|meds?|dos(?:e|es|age|ing)|units?|inject(?:s|ed|ing|ion|ions)?|pills?|tablets?|prescri\w+)\b/i
  },
  {
    label: "delivery-word",
    pattern: /\b(?:induc(?:e|ed|tion)|c-?section|ca?esarean|deliver(?:y|ed|ing|s)?|labou?r|birth|due\s+date)\b/i
  },
  { label: "digit", pattern: /\d/ },
  {
    label: "reduction",
    pattern:
      /\b(?:eat(?:ing)?\s+less|smaller\s+portions?|cut\s+(?:back|down|out)|reduc(?:e|ed|ing)|restrict\w*|avoid\w*|limit\w*|skip\s+(?:a\s+)?(?:meal|snack|breakfast|lunch|dinner))\b/i
  }
];

const KNOWN_BAD: Record<string, string> = {
  "banned-string-safe": "Ideas that are safe to eat",
  "banned-string-for-your-baby": "A calmer plan for your baby",
  "grading-word": "You had a good day",
  "blame-grammar": "You went over at lunch",
  gamification: "Keep your streak going",
  "medication-word": "Are you taking insulin?",
  "delivery-word": "Questions about your induction",
  digit: "Aim for 45 grams",
  reduction: "Try eating less at dinner"
};

const allStrings = GDM_BANKS.flatMap((bank) =>
  Object.entries(bank.rows).flatMap(([id, strings]) => strings.map((text) => ({ bank: bank.name, id, text })))
);

/**
 * Ruling R5 (controller): the last case's guard walks the TypeScript AST over
 * "rendered positions" only, instead of the brief's two regexes (which read
 * `days > limit && <Row />` as JSX text and cannot see `{"Saving"}`, a
 * ternary, `aria-label={'Close'}` or a template literal — the ways a literal
 * really arrives).
 */
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/**
 * Ruling R38 (controller): a string-initialised attribute on a COMPONENT
 * element — a capitalised JSX tag (`<Button>`) or a property-access tag
 * (`<Foo.Bar>`) — is exempt from the literal-copy guard when its value is a
 * closed-enum token: lowercase, digits and underscores only, starting with a
 * letter. A DOM (lowercase) element is unchanged: `<input placeholder="Type
 * here" />` still flags. This lets a call site write `<GdmDoorShown
 * surface="landing" />` directly instead of routing every closed-enum prop
 * through a lookup-object indirection (Task L.1's `GDM_DOOR_SURFACE`
 * workaround, reverted in L.2) — the guard cannot otherwise tell a technical
 * enum from user-visible copy, but a bare lowercase token never is copy
 * (product strings are sentence case).
 */
const CLOSED_ENUM_TOKEN = /^[a-z][a-z0-9_]*$/;

/** The plan's 14, plus the attributes named in R5 that are never copy. */
const ATTRIBUTE_ALLOWLIST = new Set([
  "className",
  "href",
  "id",
  "type",
  "role",
  "htmlFor",
  "inputMode",
  "accept",
  "capture",
  "name",
  "rel",
  "target",
  "key",
  "autoComplete",
  "aria-live",
  "aria-describedby",
  "aria-labelledby",
  "aria-controls",
  "aria-current",
  "aria-hidden",
  "loading",
  "src",
  "download",
  "style",
  "lang",
  "dateTime"
]);

function attributeName(attr: ts.JsxAttribute): string {
  return ts.isIdentifier(attr.name) ? attr.name.text : attr.name.getText();
}

function isAllowlistedAttribute(name: string): boolean {
  return ATTRIBUTE_ALLOWLIST.has(name) || name.startsWith("on");
}

/** The tag name of the JSX element a given attribute sits on, if any. */
function enclosingTagName(attr: ts.JsxAttribute): ts.JsxTagNameExpression | undefined {
  const attributes = attr.parent;
  if (!attributes || !ts.isJsxAttributes(attributes)) return undefined;
  const element = attributes.parent;
  if (element && (ts.isJsxOpeningElement(element) || ts.isJsxSelfClosingElement(element))) {
    return element.tagName;
  }
  return undefined;
}

/** R38: a capitalised identifier (`Button`) or a property-access tag (`Foo.Bar`) is a component; anything else (a lowercase identifier, a namespaced name) is a DOM element. */
function isComponentTagName(tagName: ts.JsxTagNameExpression | undefined): boolean {
  if (!tagName) return false;
  if (ts.isPropertyAccessExpression(tagName)) return true;
  if (ts.isIdentifier(tagName)) return /^[A-Z]/.test(tagName.text);
  return false;
}

/**
 * Bounded descent inside a `JsxExpression` (a child `{…}` or the value of a
 * non-allowlisted, non-`on*` attribute). Only these node kinds are
 * transparent; every other kind is opaque and passes without descent.
 */
function scanExpressionForLiteralCopy(expr: ts.Expression | undefined, report: (text: string) => void): void {
  if (!expr) return;

  if (ts.isConditionalExpression(expr)) {
    scanExpressionForLiteralCopy(expr.whenTrue, report);
    scanExpressionForLiteralCopy(expr.whenFalse, report);
    return;
  }

  if (ts.isBinaryExpression(expr)) {
    const op = expr.operatorToken.kind;
    if (
      op === ts.SyntaxKind.AmpersandAmpersandToken ||
      op === ts.SyntaxKind.BarBarToken ||
      op === ts.SyntaxKind.QuestionQuestionToken
    ) {
      scanExpressionForLiteralCopy(expr.left, report);
      scanExpressionForLiteralCopy(expr.right, report);
    }
    return;
  }

  if (ts.isParenthesizedExpression(expr)) {
    scanExpressionForLiteralCopy(expr.expression, report);
    return;
  }

  if (ts.isAsExpression(expr) || ts.isSatisfiesExpression(expr) || ts.isNonNullExpression(expr)) {
    scanExpressionForLiteralCopy(expr.expression, report);
    return;
  }

  if (ts.isTemplateExpression(expr)) {
    if (HAS_LETTER_OR_DIGIT.test(expr.head.text)) report(expr.head.text);
    for (const span of expr.templateSpans) {
      // A `${…}` substitution is a rendered position too: descend into it
      // with the same bounded whitelist (an identifier or a bank lookup
      // stays opaque; a ternary/logical with string literals is flagged).
      scanExpressionForLiteralCopy(span.expression, report);
      if (HAS_LETTER_OR_DIGIT.test(span.literal.text)) report(span.literal.text);
    }
    return;
  }

  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    if (HAS_LETTER_OR_DIGIT.test(expr.text)) report(expr.text);
    return;
  }

  // Every other node kind (ElementAccess, PropertyAccess, calls, arrow/function
  // expressions, object/array literals, comparisons, identifiers, JSX
  // elements, …) is opaque and passes without descent.
}

/** Flags rendered positions only. Returns one description string per hit. */
function findLiteralCopyOffenders(sourceText: string, fileLabel: string): string[] {
  const sourceFile = ts.createSourceFile(fileLabel, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const offenders: string[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      if (HAS_LETTER_OR_DIGIT.test(node.text)) offenders.push(`${fileLabel}: JsxText "${node.text.trim()}"`);
    } else if (ts.isJsxAttribute(node)) {
      const name = attributeName(node);
      const allowed = isAllowlistedAttribute(name);
      if (node.initializer) {
        if (ts.isStringLiteral(node.initializer)) {
          const text = node.initializer.text;
          const exemptEnumProp =
            isComponentTagName(enclosingTagName(node)) && CLOSED_ENUM_TOKEN.test(text);
          if (!allowed && !exemptEnumProp && HAS_LETTER_OR_DIGIT.test(text)) {
            offenders.push(`${fileLabel}: attribute "${name}"="${text}"`);
          }
        } else if (ts.isJsxExpression(node.initializer) && !allowed) {
          scanExpressionForLiteralCopy(node.initializer.expression, (text) =>
            offenders.push(`${fileLabel}: attribute "${name}"={${text}}`)
          );
        }
      }
    } else if (ts.isJsxExpression(node) && !(node.parent && ts.isJsxAttribute(node.parent))) {
      // A child `{…}`, not an attribute value (those are handled above).
      scanExpressionForLiteralCopy(node.expression, (text) => offenders.push(`${fileLabel}: {${text}}`));
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return offenders;
}

/** Each control names the text the walker must flag, not just that it flags something. */
const LITERAL_KNOWN_BAD: Record<string, { snippet: string; expectedFlags: string[] }> = {
  "jsx-text": { snippet: "<p>Saving</p>", expectedFlags: ["Saving"] },
  "jsx-expression-string": { snippet: '<p>{"Saving"}</p>', expectedFlags: ["Saving"] },
  "conditional-string": { snippet: '<p>{saving ? "Saving" : label}</p>', expectedFlags: ["Saving"] },
  "attribute-expression-string": { snippet: "<button aria-label={'Close'} />", expectedFlags: ["Close"] },
  "template-literal": { snippet: "<p>{`Hello ${name}`}</p>", expectedFlags: ["Hello"] },
  "attribute-string-literal": { snippet: '<input placeholder="Type here" />', expectedFlags: ["Type here"] },
  "component-attribute-not-enum-shaped": { snippet: '<Button label="Save" />', expectedFlags: ["Save"] },
  "component-attribute-multiword": { snippet: '<Button label="save now" />', expectedFlags: ["save now"] },
  "template-substitution": {
    snippet: '<p>{`${saving ? "Saving" : "Saved"}`}</p>',
    expectedFlags: ["Saving", "Saved"]
  }
};

const LITERAL_KNOWN_GOOD: Record<string, string> = {
  "comparison-and-element": "<>{days > limit && <Row />}</>",
  "equality-and-element": '<>{state === "waiting" && <Row />}</>',
  "on-handler": 'const _x = <button onClick={() => track({ name: "x" })} />;',
  "aria-live-allowlisted": '<p aria-live="polite" />',
  "element-access-bank-lookup": '<p>{GDM_COPY["gdm-door-name"].name}</p>',
  "template-of-identifiers": "<p>{`${label} · ${value}`}</p>",
  "allowlisted-href-and-classname": '<a href="/gdm" className="primary-button">{label}</a>',
  "punctuation-jsx-text": "<p>{label}: {value}</p>",
  "component-enum-prop": '<GdmDoorShown surface="landing" />'
};

describe("GDM copy banks — one test over every product-authored string (PRD §9.3)", () => {
  it("has a control sample for every family, and every control trips its family", () => {
    expect(Object.keys(KNOWN_BAD).sort()).toEqual(FAMILIES.map((f) => f.label).sort());
    for (const family of FAMILIES) expect(KNOWN_BAD[family.label]).toMatch(family.pattern);
  });

  it("no bank string trips a family", () => {
    const hits = allStrings.flatMap(({ id, text }) =>
      FAMILIES.filter((f) => !f.exemptRows?.includes(id) && f.pattern.test(text)).map((f) => `${id}: "${text}" → ${f.label}`)
    );
    expect(hits).toEqual([]);
  });

  it("ledger parity: every bank row is a ledger row with the same strings, Active, in a GDM claim class", () => {
    const failures: string[] = [];
    // getCopyLedgerRows is plain .mjs with no JSDoc types, so TS infers each
    // row as `{}` (built via `row[headers[i]] = …` in a loop it can't type
    // narrowly) -- cast once here instead of widening the callback parameter.
    const ledger = getCopyLedgerRows(
      fs.readFileSync(path.join(ROOT, "docs/safety/copy-ledger.md"), "utf8"),
      failures
    ) as Array<Record<string, string>>;
    expect(failures).toEqual([]);
    for (const bank of GDM_BANKS) {
      for (const [id, strings] of Object.entries(bank.rows)) {
        const row = ledger.find((entry) => entry["Copy ID"] === id);
        expect(row, `${id} has no ledger row`).toBeDefined();
        expect(row!.Copy, `${id}: ledger Copy cell differs from the bank`).toBe(strings.join(" · "));
        expect(row!.Active).toBe("Yes");
        expect(["gdm-organiser", "gdm-food-ideas", "gdm-plan-read"]).toContain(row!["Allowed Claim Class"]);
      }
    }
  });

  it("flag parity: the surfaces list exactly the rows the banks hold", () => {
    const inBanks = GDM_BANKS.flatMap((bank) => Object.keys(bank.rows)).sort();
    const inSurfaces = [...new Set(Object.values(GDM_SURFACE_ROWS).flat())].sort();
    expect(inSurfaces).toEqual(inBanks);
  });

  it("has a control sample for every literal-copy bypass, and each known-good pattern passes (ruling R5)", () => {
    for (const [label, { snippet, expectedFlags }] of Object.entries(LITERAL_KNOWN_BAD)) {
      const offenders = findLiteralCopyOffenders(snippet, label);
      expect(offenders, label).not.toEqual([]);
      for (const flag of expectedFlags) {
        expect(
          offenders.some((offender) => offender.includes(flag)),
          `${label}: expected an offender mentioning "${flag}", got ${JSON.stringify(offenders)}`
        ).toBe(true);
      }
    }
    for (const [label, snippet] of Object.entries(LITERAL_KNOWN_GOOD)) {
      expect(findLiteralCopyOffenders(snippet, label), label).toEqual([]);
    }
  });

  it("GDM components carry no literal copy — every visible string comes from a bank", () => {
    const files = ["app/gdm", "components/gdm"].flatMap((dir) => walk(dir));
    const offenders = files.flatMap((rel) =>
      findLiteralCopyOffenders(fs.readFileSync(path.join(ROOT, rel), "utf8"), rel)
    );
    expect(offenders).toEqual([]);
  });
});

function walk(dir: string, out: string[] = []): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(rel, out);
    else if (entry.name.endsWith(".tsx")) out.push(rel);
  }
  return out;
}
