import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Audit 2026-09-05: the public privacy page kept naming Railway as the
 * database processor five weeks after the 2026-08-10 move to Neon
 * (docs/runbooks/incident-2026-08-10-database-outage.md). A sub-processor
 * disclosure that names the wrong provider is a privacy-notice defect, and
 * the counsel brief is the lockstep twin of that page (docs/privacy/data-flow.md
 * "lockstep rule"). Pin both to the current host so the next migration cannot
 * drift silently.
 */
const CURRENT_DATABASE_HOST = /Neon-hosted Postgres/;
const RETIRED_DATABASE_HOST = /Railway-hosted/;

describe("privacy sub-processor disclosure names the current database host", () => {
  it.each(["app/(app)/privacy/page.tsx", "docs/legal/counsel-brief.md"])(
    "%s names Neon, not Railway",
    (path) => {
      const contents = readFileSync(resolve(process.cwd(), path), "utf8");
      expect(contents).toMatch(CURRENT_DATABASE_HOST);
      expect(contents).not.toMatch(RETIRED_DATABASE_HOST);
    }
  );
});
