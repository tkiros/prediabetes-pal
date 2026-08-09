
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

## Legacy internal name

The product was renamed Revora → **Prediabetes Pal** (2026-08-09,
`docs/naming-decision-shortlist.md`). The `revora` prefix in internal
identifiers is the legacy name and is **deliberately retained**: `lib/revora/`,
`tests/unit/revora/`, the 13 `REVORA_*` env vars, `test:revora`/`eval:revora*`
npm scripts, `x-revora-*` headers, `revora.*` storage keys, and the TWA
`packageId` `app.revora.twa`. Renaming them risks env/code lockstep outages for
zero user benefit — do not "clean this up". `docs/handoff/**` and
`docs/archive/**` keep the old name too; they are historical records.
