/**
 * The live-example demo (handoff §7): the product in action, as static fixture
 * markup using the REAL result-card classes — always pixel-true, crawlable, and
 * claims-audited via the copy ledger. No live check runs here.
 *
 * It shows the HONEST oatmeal sequence (Plan §P1.1 / K1): the user types
 * "oatmeal", Prediabetes Pal asks one clarifying question instead of guessing, the user
 * supplies the missing context, and only THEN does the card appear. The three
 * interaction strings (input, question, answer) come from the promise registry
 * — not retyped here — so `promise-registry.test.ts` pins the clarify question
 * to the precheck's real output and blocks the deploy if the flow ever changes.
 */
import { OATMEAL_EXAMPLE } from "../lib/pal/promise-registry";
import { DisclaimerLine } from "./disclaimer-line";
import { IconAlert, IconArrowRight, IconLeaf } from "./icons";

/**
 * AUD-008: the framing follows the evidence state. Until an authorized live
 * capture exists (lastLiveCaptureAt on the registry entry), the card is an
 * ILLUSTRATION — the interaction shape is real and pinned by
 * promise-registry.test.ts, but the wording has never been reproduced on the
 * current live model path, so it must not be sold as "the actual answer".
 */
export function demoExampleEyebrow(lastLiveCaptureAt: string | null): string {
  if (!lastLiveCaptureAt) {
    return "An illustrated example";
  }
  const date = new Date(`${lastLiveCaptureAt}T00:00:00.000Z`).toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }
  );
  return `A real check, captured ${date}`;
}

/**
 * The three ledgered lines (`demo-check-reason` / `-adjustment` / `-swap`).
 * Hoisted when there were two layouts to keep in step; kept hoisted now there
 * is one, because the reason was never the second layout. Typed ONCE — two copies
 * of a ledgered string is how a card and its ledger row quietly stop agreeing,
 * and `demo-check-card.test.ts` pins these against the ledger by source match,
 * which a second copy would still satisfy.
 */
const REASON =
  "Oatmeal on its own is a carb-heavy start, so it can have a higher blood-sugar impact than its healthy reputation suggests.";
const ADJUSTMENT =
  "If practical, add protein — Greek yogurt, nuts, or eggs on the side — to make it easier to handle.";
const SWAP = "Steel-cut oats hold up steadier than instant packets.";

/**
 * ONE shape, the app's. Until 2026-08-14 a `layout="table"` prop rendered a
 * second, landing-only shape — the design file's six-row label-gutter
 * drawing. It went with the owner ruling that put step two's art inside a
 * phone frame: a frame asserts that what it holds is a screen, and no route
 * in this app draws that table. The landing now renders what `/check` and
 * `/demo` render, which is the only version of this component that was ever
 * true.
 *
 * ⛔ Do not reintroduce a marketing-only layout here. A prop that lets a
 * landing page restyle an in-app surface is the same drift
 * `landing-design-guards` GUARD 1 blocks in CSS, wearing a different hat.
 */
export function DemoCheckCard() {
  const example = OATMEAL_EXAMPLE;
  return (
    <section
      className="surface-card hero-card"
      aria-label="Example check"
      data-testid="demo-check-card"
    >
      <p className="status-eyebrow">
        {demoExampleEyebrow(example.lastLiveCaptureAt)}
      </p>

      {/* Step 1 — the user enters a genuinely ambiguous food. */}
      <p className="page-copy">
        You type: <strong>{example.input}</strong>
      </p>

      {/* Step 2 — Prediabetes Pal asks one clarifying question instead of guessing.

          ⛔ KEEP `data-testid="demo-clarify"` AND KEEP THIS BLOCK WHERE IT IS.
          The landing's one animation is this element plus every FOLLOWING
          SIBLING on a 520ms delay, so the pause reads as a pause
          (`.landing-pause-stage`, globals.css). Reorder these blocks and the
          beat silently lands on a different part of the flow; move this one
          later and the reveal covers less of it. Nothing goes red — the
          selectors still match, they just match the wrong thing. This warning
          used to live in the deleted table layout and its CSS; those were the
          only two copies. */}
      <div
        className="result-card"
        data-kind="clarify"
        data-testid="demo-clarify"
      >
        <p className="result-eyebrow">Need one more detail</p>
        <p className="page-copy">{example.expectedClarifyQuestion}</p>
      </div>

      {/* Step 3 — the user supplies the missing context. */}
      <p className="page-copy">
        You answer: <strong>{example.followUp}</strong>
      </p>

      {/* Step 4 — the resulting card. */}
      <div className="result-card" data-risk="MODERATE">
        <p className="result-eyebrow">Prediabetes Pal result</p>
        <p className="result-title verdict-title" data-risk="MODERATE">
          <IconAlert size={26} />
          Be careful
        </p>
        <p className="page-copy">{REASON}</p>
        <div className="result-list">
          <p className="page-copy result-row">
            <IconLeaf size={16} />
            <span>
              <strong>Adjustment:</strong> {ADJUSTMENT}
            </span>
          </p>
          <p className="page-copy result-row">
            <IconArrowRight size={16} />
            <span>
              <strong>Swap:</strong> {SWAP}
            </span>
          </p>
        </div>
        <DisclaimerLine />
      </div>
    </section>
  );
}
