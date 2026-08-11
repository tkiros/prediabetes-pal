import { loadSafetyContract } from "../lib/pal/safety-contract";
import type { VideoSpec, ComplianceItem } from "./schema";

// Mirror scripts/validate-safety-contract.mjs:446 exactly.
function compile(entry: { pattern: string; flags?: string }): RegExp {
  return new RegExp(entry.pattern, entry.flags || "i");
}

// Genuinely-fatal claim families (§5/§10). Everything else in forbiddenClaims (treatment,
// prevention) is a FLAG so innocent marketing ("treat yourself") doesn't block a spec.
const HARD_FAIL_CLAIM_LABELS = new Set([
  "diagnosis", "cure", "reversal", "fda approval", "unsupported clinical proof",
]);

// §6.1 forbidden-hook families. Not in the product-copy fixture — defined here. The LLM
// layer (Task 6) is the primary catch for tone; these regexes catch the obvious markers.
const FORBIDDEN_HOOKS: Array<{ rule: string; pattern: RegExp }> = [
  { rule: "hook:fear/urgency", pattern: /\b(right now|before it'?s too late|act now|don'?t wait|urgent(ly)?)\b/i },
  { rule: "hook:fear/urgency", pattern: /\b\d+\s+(seconds?|minutes?|hours?|days?)\s+(left|to go|until)\b/i },
  { rule: "hook:dramatic-results", pattern: /\b(fixed|cured|reversed|healed|dropped|lowered|normalized)\b[^.]{0,25}\b(a1c|blood sugar|prediabetes|diabetes)\b/i },
  { rule: "hook:dramatic-results", pattern: /\b(my|his|her|their)\s+a1c\b[^.]{0,25}\b(dropped|fell|went down|normalized|plummeted)\b/i },
  { rule: "hook:polarizing/taboo", pattern: /\b(shouldn'?t|don'?t)\s+deserve\b|\b(idiots?|losers?|stupid)\b/i },
];

function scannedFields(spec: VideoSpec): Array<{ field: string; text: string }> {
  // disclosure_block is a controlled field (approved disclaimer) — excluded from the banned-claim
  // scan so "not a diagnosis"-style wording can't false-hard-fail. Adequacy is checked separately.
  return [
    { field: "spoken_hook", text: spec.spoken_hook },
    { field: "visual_hook", text: spec.visual_hook },
    { field: "caption_text", text: spec.caption_text },
    ...spec.beats.map((t, i) => ({ field: `beats[${i}]`, text: t })),
    ...spec.asset_list.map((t, i) => ({ field: `asset_list[${i}]`, text: t })),
  ];
}

export function runRegexChecks(spec: VideoSpec): ComplianceItem[] {
  const { fixture, copy } = loadSafetyContract();
  const items: ComplianceItem[] = [];
  const seen = new Set<string>();
  const push = (severity: "hard_fail" | "flag", rule: string, text: string, re: RegExp) => {
    const span = text.match(re)?.[0] ?? "";
    const key = `${rule}|${span}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ layer: "regex", severity, rule, span });
  };

  for (const { text } of scannedFields(spec)) {
    for (const entry of fixture.forbiddenClaims) {
      const re = compile(entry);
      if (re.test(text)) {
        const severity = HARD_FAIL_CLAIM_LABELS.has(entry.label) ? "hard_fail" : "flag";
        push(severity, `claim:${entry.label}`, text, re);
      }
    }
    for (const entry of fixture.forbiddenPredictions) {
      const re = compile(entry);
      if (re.test(text)) push("hard_fail", `prediction:${entry.label}`, text, re);
    }
    for (const entry of fixture.qualitativeOnly.forbiddenPatterns) {
      const re = compile(entry);
      if (re.test(text)) push("hard_fail", `number:${entry.label}`, text, re);
    }
    for (const hook of FORBIDDEN_HOOKS) {
      if (hook.pattern.test(text)) push("hard_fail", hook.rule, text, hook.pattern);
    }
  }

  // Disclosure adequacy: if claims are used, the block must carry the approved disclaimer verbatim.
  if (spec.claims_used.length > 0 && !spec.disclosure_block.includes(copy.disclaimer)) {
    items.push({
      layer: "regex", severity: "flag", rule: "disclosure:missing-approved-text",
      span: spec.disclosure_block.slice(0, 60),
      suggestion: copy.disclaimer,
    });
  }

  return items;
}
