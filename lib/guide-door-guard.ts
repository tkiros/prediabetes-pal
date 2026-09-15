import type { A1CBand } from "./pal/a1c";
import { GUIDE_IDEAS } from "./pal/guide-ideas";
import { stripProviderPrefix } from "./pal/model-id";
import {
  GUIDE_SURFACES,
  SURFACE_REQUIRES,
  SURFACE_ROWS,
  type GuideSurface
} from "./guide-door-flag";

/**
 * The production door guard (Task 1.11; plan amendments A-63, A-94, A-100,
 * A-101, A-119). NEXT_PUBLIC_GUIDE_DOOR is a build flag with no server twin,
 * so the production value is the only thing standing between a Pending row
 * and a real user. This is what finally connects docs/safety/copy-ledger.md
 * to what a build renders (DESIGN.md §1.1's named gap).
 *
 * Pure: no fs, no env. next.config.ts (production builds only) and
 * scripts/check-production-config.ts read the ledger, the labels file,
 * PROMPT_VERSION and activeModelId() and pass them in.
 *
 * Errors (the build throws — each message carries its fix):
 *   1. the value `1` (A-94: "never `1` in production" is a guard, not a sentence);
 *   2. an unknown surface token;
 *   3. a surface listed without a surface it requires (SURFACE_REQUIRES);
 *   4. a surface other than `calm` with no ledger rows yet, or any of its
 *      rows not both `Status = Approved` and `Active = Yes` (a missing row is
 *      neither; a retired one renders copy the ledger says is on no surface).
 * Warning (the build continues — A-100, a prompt hotfix is never blocked by
 * the idea bank): when the list opens `ideas` or `ideas-full` and the idea
 * labels are stale, missing, or not all SAFE, both are dropped from
 * `effective` — and so, transitively, is every surface whose
 * SURFACE_REQUIRES are no longer all open (home, orient, intake), each named
 * in the warning — so /api/health's guideDoor reads them "off".
 *
 * `effective` is the value to inline: the listed surfaces in input order,
 * deduplicated, minus any dropped ones — or "" whenever there is an error
 * (fail closed; the build throws anyway).
 */

export type DoorCheck = { effective: string; errors: string[]; warnings: string[] };

/** The bands the idea-label eval writes (tests/support LABEL_BANDS, pinned equal there). */
export const IDEA_LABEL_BANDS = [
  "prediabetes_57_59",
  "prediabetes_60_62",
  "prediabetes_63_64"
] as const satisfies readonly A1CBand[];

/**
 * lib/pal/guide-ideas.labels.json as the guard reads it. Structural and
 * loose on purpose: the file is JSON off disk, so every field is checked at
 * run time and a malformed file reads as stale, never as fresh.
 */
export type IdeaLabelsFile = {
  promptVersion?: string;
  model?: string;
  labels?: Record<
    string,
    { text?: string } & Partial<Record<(typeof IDEA_LABEL_BANDS)[number], { risk?: string }>>
  >;
};

export const IDEA_LABELS_PATH = "lib/pal/guide-ideas.labels.json";
export const COPY_LEDGER_PATH = "docs/safety/copy-ledger.md";

const IDEAS_SURFACES: readonly GuideSurface[] = ["ideas", "ideas-full"];
/** Idea-level reasons named before the rest are counted. */
const MAX_NAMED_IDEA_REASONS = 3;

export function checkProductionDoor(
  value: string | undefined,
  ledgerText: string,
  labels: IdeaLabelsFile | null,
  promptVersion: string,
  modelId: string
): DoorCheck {
  const raw = (value ?? "").trim();
  if (raw === "1") {
    return {
      effective: "",
      errors: [
        'NEXT_PUBLIC_GUIDE_DOOR is "1" in production — list the surfaces whose rows are Approved instead'
      ],
      warnings: []
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const surfaces: GuideSurface[] = [];
  const tokens = [...new Set(raw.split(",").map((token) => token.trim()).filter(Boolean))];
  for (const token of tokens) {
    if (isGuideSurface(token)) surfaces.push(token);
    else errors.push(`unknown surface "${token}" — one of: ${GUIDE_SURFACES.join(", ")}`);
  }

  const listed = new Set<GuideSurface>(surfaces);
  for (const surface of surfaces) {
    const missing = (SURFACE_REQUIRES[surface] ?? []).filter((required) => !listed.has(required));
    if (missing.length === 0) continue;
    errors.push(
      `surface "${surface}" requires ${missing.map((m) => `"${m}"`).join(", ")} — ` +
        `add ${missing.length === 1 ? "it" : "them"} or remove "${surface}"`
    );
  }

  const statuses = ledgerStatuses(ledgerText);
  for (const surface of surfaces) {
    const rows = SURFACE_ROWS[surface];
    if (surface === "calm") continue;
    if (rows.length === 0) {
      errors.push(`surface "${surface}" has no ledger rows yet — remove it`);
      continue;
    }
    for (const row of rows) {
      const found = statuses.get(row);
      if (!found) {
        errors.push(
          `surface "${surface}" renders row "${row}" which is not in the copy ledger — ` +
            `file it, get it Approved, or remove "${surface}"`
        );
        continue;
      }
      // Status first, Active second, so each row names one failed half.
      const notApproved = found.find((state) => state.status !== "Approved");
      if (notApproved !== undefined) {
        errors.push(
          `surface "${surface}" renders row "${row}" whose Status is ${notApproved.status || "empty"} — ` +
            `get it Approved or remove "${surface}"`
        );
        continue;
      }
      const retired = found.find((state) => state.active !== "Yes");
      if (retired !== undefined) {
        errors.push(
          `surface "${surface}" renders row "${row}" whose Active is ${retired.active || "empty"} (retired) — ` +
            `reactivate the row or remove "${surface}"`
        );
      }
    }
  }

  let open = surfaces;
  if (surfaces.some((surface) => IDEAS_SURFACES.includes(surface))) {
    const reasons = ideaLabelStaleness(labels, promptVersion, modelId);
    if (reasons.length > 0) {
      open = surfaces.filter((surface) => !IDEAS_SURFACES.includes(surface));
      // Fix round 1: closing the ideas surfaces must not leave a surface open
      // whose requirement is now closed (home's quick row, orient's step 4,
      // and intake through orient). Drop dependents until the list is stable.
      for (let changed = true; changed; ) {
        const stillOpen = new Set<GuideSurface>(open);
        const kept = open.filter((surface) =>
          (SURFACE_REQUIRES[surface] ?? []).every((required) => stillOpen.has(required))
        );
        changed = kept.length !== open.length;
        open = kept;
      }
      const dependents = surfaces.filter(
        (surface) => !IDEAS_SURFACES.includes(surface) && !open.includes(surface)
      );
      const named =
        dependents.length === 0
          ? '"ideas" and "ideas-full"'
          : [...IDEAS_SURFACES, ...dependents].map((surface) => `"${surface}"`).join(", ");
      warnings.push(
        `idea labels are stale (${reasons.join(", or ")}) — ${named} dropped from this build; ` +
          "run npm run eval:pal:ideas"
      );
    }
  }

  return { effective: errors.length > 0 ? "" : open.join(","), errors, warnings };
}

/**
 * Why the idea labels cannot vouch for this build (empty = fresh): no file,
 * a different PROMPT_VERSION or model (A-100/A-117), or a bank line whose
 * text drifted, has no label, or is not SAFE at every band (A-91). The unit
 * gate (tests/unit/pal/guide-ideas-labels.test.ts) also fails on the last
 * three; the guard repeats them so a non-SAFE label can never reach
 * production through a skipped or bypassed gate.
 */
export function ideaLabelStaleness(
  labels: IdeaLabelsFile | null,
  promptVersion: string,
  modelId: string
): string[] {
  if (!labels || typeof labels !== "object") return [`no readable ${IDEA_LABELS_PATH}`];

  const reasons: string[] = [];
  if (labels.promptVersion !== promptVersion) {
    reasons.push(`prompt ${promptVersion} ≠ ${String(labels.promptVersion)}`);
  }
  const model = stripProviderPrefix(modelId);
  if (labels.model !== model) {
    reasons.push(`model ${model} ≠ ${String(labels.model)}`);
  }

  const ideaReasons: string[] = [];
  for (const idea of GUIDE_IDEAS) {
    const entry = labels.labels?.[idea.id];
    if (!entry) {
      ideaReasons.push(`idea "${idea.id}" has no label`);
      continue;
    }
    if (entry.text !== idea.text) {
      ideaReasons.push(`idea "${idea.id}" text changed since the eval`);
      continue;
    }
    const band = IDEA_LABEL_BANDS.find((b) => entry[b]?.risk !== "SAFE");
    if (band) ideaReasons.push(`idea "${idea.id}" is ${entry[band]?.risk ?? "unlabelled"} at ${band}`);
  }
  reasons.push(...ideaReasons.slice(0, MAX_NAMED_IDEA_REASONS));
  if (ideaReasons.length > MAX_NAMED_IDEA_REASONS) {
    reasons.push(`${ideaReasons.length - MAX_NAMED_IDEA_REASONS} more ideas`);
  }
  return reasons;
}

/** One ledger occurrence of a Copy ID: the two cells the door reads. */
export type LedgerRowState = { status: string; active: string };

/**
 * Copy ID → every occurrence recorded for it, across every markdown table
 * whose header names both `Copy ID` and `Status` (the ledger has more than
 * one). Same cell rules as scripts/validate-safety-contract.mjs: split on `|`,
 * trim, strip one pair of backticks. An ID listed twice opens a surface only
 * if every row says Approved AND Yes.
 *
 * A table with `Copy ID` + `Status` but no `Active` column reads as
 * `active: "Yes"`: the column was added after the first tables were written,
 * and absence of the column is not retirement — failing closed on it would
 * reject every table that predates it. A table that HAS the column and leaves
 * the cell empty is a different thing and reads as not-Yes, exactly as a
 * missing Status cell reads as not-Approved.
 */
export function ledgerStatuses(ledgerText: string): Map<string, LedgerRowState[]> {
  const statuses = new Map<string, LedgerRowState[]>();
  let columns: { id: number; status: number; active: number } | null = null;
  let expectSeparator = false;

  for (const line of ledgerText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) {
      columns = null;
      expectSeparator = false;
      continue;
    }
    const cells = splitTableRow(trimmed);
    if (expectSeparator) {
      expectSeparator = false;
      if (!/^(\|\s*:?-{3,}:?\s*)+\|$/.test(trimmed)) columns = null;
      continue;
    }
    if (!columns) {
      const id = cells.indexOf("Copy ID");
      const status = cells.indexOf("Status");
      if (id !== -1 && status !== -1) {
        columns = { id, status, active: cells.indexOf("Active") };
        expectSeparator = true;
      }
      continue;
    }
    const copyId = cells[columns.id];
    if (!copyId) continue;
    const list = statuses.get(copyId) ?? [];
    list.push({
      status: cells[columns.status] ?? "",
      active: columns.active === -1 ? "Yes" : (cells[columns.active] ?? "")
    });
    statuses.set(copyId, list);
  }
  return statuses;
}

function splitTableRow(row: string): string[] {
  return row
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim().replace(/^`(.+)`$/, "$1"));
}

function isGuideSurface(token: string): token is GuideSurface {
  return (GUIDE_SURFACES as readonly string[]).includes(token);
}
