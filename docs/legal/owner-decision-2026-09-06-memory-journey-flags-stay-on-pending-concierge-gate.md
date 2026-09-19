# Owner decision (PROPOSED) — meal memory and learning journey stay ON; the concierge study is the exit condition

**Drafted:** 2026-09-06 by the audit agent · **Status:** awaiting owner signature — nothing here is in force until initialled
**Context:** Decision B in `docs/handoff/2026-09-06-prediabetes-pal-value-necessity-business-execution-plan.md` §2; audit finding F-006 in `docs/handoff/2026-09-05-revora-e2e-promise-retention-audit-report.md`.
**Sibling entries:** `owner-decision-2026-08-14-longitudinal-insights-on.md`, `owner-decision-2026-08-14-photo-assist-on.md` (same shape: a function was found ON without its own decision record; the record was written after the fact and says so).

## What is true today

| Source | State |
|---|---|
| `docs/release/truth-index.md` §2 (flag ledger) | `NEXT_PUBLIC_MEAL_MEMORY` + `MEAL_MEMORY_ENABLED`, `NEXT_PUBLIC_LEARNING_JOURNEY` + `LEARNING_JOURNEY_ENABLED`: **ENABLED in production since 2026-07-27** |
| Same ledger, "Enablement gate" column | **Phase 2.6 discovery gate** — ≥ 5 of 8 completing concierge participants recall the memory ≥ twice and continue at the disclosed price |
| `docs/research/meal-memory-concierge-protocol.md` §10 decision record | never executed; blank |
| `docs/retention_flow.md` "Required order of operations" step 5 | "Do not enable the new journey broadly before this passes." |
| `docs/legal/owner-risk-launch-decision-5f6abcb.md` (2026-07-17) | blanket owner-risk acceptance; no memory/journey-specific line |
| Production reachability | offline since 2026-08-25 (registrar hold); the flags' ON state has had no public effect since then |

So: the flags are on, the gate that was supposed to precede them never ran, and no decision record names them. This entry closes the record; it does not claim the gate was cleared.

## Proposed decision

**Leave both flag pairs ON, and make the concierge study the exit condition, in either direction.**

1. Run `docs/research/meal-memory-concierge-protocol.md` exactly as written (≥ 8 completers, three weeks, one disclosed price, stop-interviews), with the built product as the "concierge prototype" — the protocol allows the researcher to use the real surface as long as the core card band is never changed (§4).
2. **PASS (≥ 5 of 8):** the flags stay on; the ledger's enablement-gate cell is updated to "cleared <date>, protocol §10 record".
3. **FAIL:** both pairs go OFF in the next deploy, and the owner chooses among the protocol's §7.1 outcomes (fixed-duration guide, free archive, or stop the subscription thesis). Turning them off is a two-variable env change per pair (`next.config.ts` twin guard requires both together).

Why not turn them off now: production is unreachable, so an OFF today changes nothing for any user and removes the only way to observe the behaviour the study measures. Why not leave it undocumented: the truth index says enablement is a discovery-gate decision, not an engineering toggle, and the two sibling entries set the precedent that an after-the-fact record beats silence.

## What this authorizes / does not touch

- Authorizes: keeping `MEAL_MEMORY_ENABLED=1`, `NEXT_PUBLIC_MEAL_MEMORY=1`, `LEARNING_JOURNEY_ENABLED=1`, `NEXT_PUBLIC_LEARNING_JOURNEY=1` in production **until the study's §10 record exists**.
- Does not touch: the fail-closed code defaults; the counsel, RD/CDCES, privacy (memory stores encrypted meal text), and accessibility gates (`docs/release/truth-index.md` §3, all open); any marketing claim about memory or the journey (`docs/safety/claims-boundary.md` still governs; the FF ledger's "pending flag-on" copy rows are unchanged).
- Deadline: if the study has not started within 60 days of the domain being restored, this entry expires and the flags come off.

## Sign-off

Owner initials / date: ________ · Study start date: ________ · §10 record filed: ________
