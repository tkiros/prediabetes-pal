import { ledgerStatuses } from "./guide-door-guard";
import {
  GDM_SURFACES,
  GDM_SURFACE_GATES,
  GDM_SURFACE_REQUIRES,
  GDM_SURFACE_ROWS,
  type GdmSurface
} from "./gdm-door-flag";

/**
 * The GDM door's production guard. Pure: no fs, no env — next.config.ts
 * (production builds only) and scripts/check-production-config.ts read the
 * ledger and the gates record off disk and pass them in.
 *
 * It is what makes PRD §9.2's first kill line mechanical: "No gdm-organiser
 * class → nothing ships. No S1–S3 → no food content ships. No S4 → no read
 * ships." A row can only be Approved once its class exists
 * (scripts/validate-safety-contract.mjs), and a gate only reads Signed when
 * its decider wrote it (docs/safety/gdm-gates.md).
 *
 * Every error names its fix. `effective` is "" whenever there is an error.
 */
export const GDM_GATES_PATH = "docs/safety/gdm-gates.md";

/** `warnings` is present only when there is one, so `toEqual({ effective, errors })` stays exact elsewhere. */
export type GdmDoorCheck = { effective: string; errors: string[]; warnings?: string[] };

export function checkProductionGdmDoor(
  value: string | undefined,
  serverTwin: string | undefined,
  ledgerText: string,
  gatesText: string,
  rows: Record<GdmSurface, readonly string[]> = GDM_SURFACE_ROWS
): GdmDoorCheck {
  const raw = (value ?? "").trim();
  if (raw === "") return { effective: "", errors: [] };
  // G-09 — FAIL CLOSED, and first. The twin is the incident lever, so pulling it
  // alone has to work: a twin that is not "1" closes every surface and is never
  // an error, whatever else the value says. A guard that threw here would fail
  // the very redeploy that carries the revert, and the old deployment would
  // keep serving. The warning is for the first release, where a forgotten twin
  // now means a dark door and a build-log line instead of a failed build.
  if (serverTwin !== "1") {
    return {
      effective: "",
      errors: [],
      warnings: [
        "NEXT_PUBLIC_GDM_DOOR lists surfaces but GDM_DOOR_ENABLED is not 1 — every GDM surface is CLOSED in this build. " +
          "Set GDM_DOOR_ENABLED=1 to open them."
      ]
    };
  }
  if (raw === "1") {
    return {
      effective: "",
      errors: ['NEXT_PUBLIC_GDM_DOOR is "1" in production — list the surfaces whose rows are Approved instead']
    };
  }

  const errors: string[] = [];
  const surfaces: GdmSurface[] = [];
  for (const token of [...new Set(raw.split(",").map((t) => t.trim()).filter(Boolean))]) {
    if ((GDM_SURFACES as readonly string[]).includes(token)) surfaces.push(token as GdmSurface);
    else errors.push(`unknown surface "${token}" — one of: ${GDM_SURFACES.join(", ")}`);
  }

  const listed = new Set<GdmSurface>(surfaces);
  const ledger = ledgerStatuses(ledgerText);
  const gateStatus = gateStatuses(gatesText);

  for (const surface of surfaces) {
    const missing = (GDM_SURFACE_REQUIRES[surface] ?? []).filter((required) => !listed.has(required));
    if (missing.length > 0) {
      errors.push(`surface "${surface}" requires ${missing.map((m) => `"${m}"`).join(", ")} — add it or remove "${surface}"`);
    }

    for (const gate of GDM_SURFACE_GATES[surface]) {
      const status = gateStatus.get(gate) ?? "missing";
      if (status !== "Signed") {
        errors.push(
          `surface "${surface}" needs gate ${gate}, which reads "${status}" in ${GDM_GATES_PATH} ` +
            `(the cell must read exactly "Signed") — only its decider signs it; remove "${surface}" until then`
        );
      }
    }

    if (rows[surface].length === 0) {
      errors.push(`surface "${surface}" has no ledger rows yet — remove it`);
      continue;
    }
    for (const id of rows[surface]) {
      const found = ledger.get(id);
      if (!found) {
        errors.push(`surface "${surface}" renders row "${id}" which is not in the copy ledger — file it, get it Approved, or remove "${surface}"`);
        continue;
      }
      const notApproved = found.find((state) => state.status !== "Approved");
      if (notApproved) {
        errors.push(`surface "${surface}" renders row "${id}" whose Status is ${notApproved.status || "empty"} — get it Approved or remove "${surface}"`);
        continue;
      }
      const retired = found.find((state) => state.active !== "Yes");
      if (retired) {
        errors.push(`surface "${surface}" renders row "${id}" whose Active is ${retired.active || "empty"} (retired) — reactivate the row or remove "${surface}"`);
      }
    }
  }

  return { effective: errors.length > 0 ? "" : surfaces.join(","), errors };
}

/** Gate id → Status cell, from the table in docs/safety/gdm-gates.md whose header names `Gate` and `Status`. */
export function gateStatuses(gatesText: string): Map<string, string> {
  const statuses = new Map<string, string>();
  let columns: { gate: number; status: number } | null = null;
  for (const line of gatesText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) {
      columns = null;
      continue;
    }
    const cells = trimmed
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim().replace(/^`(.+)`$/, "$1"));
    if (!columns) {
      const gate = cells.indexOf("Gate");
      const status = cells.indexOf("Status");
      if (gate !== -1 && status !== -1) columns = { gate, status };
      continue;
    }
    if (/^:?-{3,}:?$/.test(cells[0] ?? "")) continue;
    if (cells[columns.gate]) statuses.set(cells[columns.gate], cells[columns.status] ?? "");
  }
  return statuses;
}
