
## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health

## Naming

The product was renamed Revora → **Prediabetes Pal** (2026-08-09,
`docs/naming-decision-shortlist.md`). Internal identifiers were migrated to the
`pal` prefix on 2026-08-10: `lib/pal/`, `tests/unit/pal/`, `PAL_*` env vars,
`test:pal`/`eval:pal*` npm scripts, `x-pal-*` headers, `pal.*` storage keys,
Upstash `pal:*` rate-limit prefixes, and the TWA `packageId`
`com.prediabetespal.twa`.

### The `revora` strings that must NOT be "cleaned up"

Four places keep the old name on purpose. Removing any of them breaks something
real:

1. **`tests/unit/pal/owned-domains.test.ts`** — `revora.app`, `revora.bio`,
   `revora.xyz`, `revora.com` are a **denylist** of domains we do *not*
   control. `revora.app` belongs to an unrelated company; `signin@revora.app`
   once shipped as the real magic-link sender. Renaming these disarms the guard.
2. **`lib/pal/contact.ts`** and **`lib/server/email.ts`** docstrings — they name
   the retired domains because that history is *why* the constants exist.
3. **`tests/unit/pal/sw-dev-teardown.test.ts`** — `revora.plus` and
   `www.revora.plus` are live production hosts (301 → `prediabetespal.com`).
   The domain stays registered; it carries every link already posted.
4. **`docs/handoff/**`, `docs/archive/**`, `docs/audit/**`, `docs/qa/**`,
   `PRD/**`, `predict/**`, `.planning/phases/**`, `.planning/research/**`** —
   historical records. A 2026-07 audit report did not audit "Prediabetes Pal".

### Rename lockstep traps

- `.github/workflows/hourly-crons.yml` `APP_URL` must equal `CANONICAL_APP_URL`
  in `scripts/run-hourly-crons.mjs` **byte-for-byte** or all four hourly jobs
  throw `invalid_app_url`.
- The prompt-leak regex in `lib/pal/postprocess.ts` and `lib/pal/eval-rubric.ts`
  matches the opening line of `lib/pal/prompt.ts`. Rename the product and you
  must change all three together —
  `tests/unit/pal/prompt-leak-guard.test.ts` now enforces this.
- `owned-domains.test.ts` hardcodes the path `lib/pal/contact.ts` to exempt that
  one file from its scan. Move the file and update the literal.

## Architecture

**`docs/architecture.md`** is the map: system diagram, the check path, data
model, API surface, features and their flags, background jobs, safety
architecture, known ceilings. Read it before touching anything outside one
component. Decisions live in **`docs/adr/`** (stack, hosting-hybrid, billing,
analytics-umami, launch-scope). Read those before touching infrastructure,
auth, billing, or data storage. `hosting-hybrid.md` opens with a superseded
note — the database is **Neon** and the hourly crons run from
**`.github/workflows/hourly-crons.yml`** since the 2026-08-10 Railway outage;
read the note, not just the body. `docs/ops/env-reference.md` is the live
source of truth for connection variables — trust it over an ADR when they
disagree. Code is the source of truth for everything else:
`lib/server/db/schema.ts` for the data model, `app/api/**/route.ts` for the
API surface, `proxy.ts` for request gating.

These files are **historical and must not be used as a source of truth**:
`.planning/research/ARCHITECTURE.md` (2026-05, describes a stateless no-auth
MVP), `PRD/Revora_Technical_Specification_v2.md` (names GPT-4o; the code uses
`lib/pal/model-id.ts`), `.planning/PROJECT.md` and `.planning/STATE.md`
(describe a phase that is finished).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
