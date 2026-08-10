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
import { OATMEAL_EXAMPLE } from "../lib/revora/promise-registry";
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
 * The three ledgered lines (`demo-check-reason` / `-adjustment` / `-swap`),
 * hoisted so the two layouts below cannot drift apart. Typed ONCE — two copies
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
 * `layout="table"` is the LANDING's rendering: the design file's six-row
 * label-gutter table (You type / Prediabetes Pal / You answer / Signal / Why / Try).
 * The default is the app's, and it is the default deliberately — `/check` and
 * `/demo` render this component too, and the design file is a marketing
 * drawing with no authority over an in-app surface. Changing the default
 * restyles two app routes to match a landing page.
 *
 * Both layouts read the same registry entry and the same three consts above,
 * so the only thing that varies is the shape.
 */
export function DemoCheckCard({ layout }: { layout?: "table" } = {}) {
  const example = OATMEAL_EXAMPLE;
  if (layout === "table") {
    return (
      <section
        className="landing-demo"
        aria-label="Example check"
        data-testid="demo-check-card"
      >
        <p className="landing-demo-eyebrow">
          {demoExampleEyebrow(example.lastLiveCaptureAt)}
        </p>
        <div className="landing-demo-row">
          <span className="landing-demo-label">You type</span>
          <span className="landing-demo-entry">{example.input}</span>
        </div>
        {/* ⚠️ KEEP `data-testid="demo-clarify"` AND KEEP THIS ROW WHERE IT IS.
            The page's one animation is `[data-testid="demo-clarify"]` plus its
            following siblings on a 520ms delay, so the pause reads as a pause
            (globals.css, `.landing-pause-stage`). In this layout every later
            row is a sibling, which is what makes the beat land on the answer
            rather than on one nested box. */}
        <div
          className="landing-demo-row landing-demo-row--ask"
          data-testid="demo-clarify"
        >
          <span className="landing-demo-label">Prediabetes Pal</span>
          <span className="landing-demo-value">
            <strong className="landing-demo-lead">Need one more detail</strong>
            <br />
            {example.expectedClarifyQuestion}
          </span>
        </div>
        <div className="landing-demo-row">
          <span className="landing-demo-label">You answer</span>
          <span className="landing-demo-entry">{example.followUp}</span>
        </div>
        <div className="landing-demo-row landing-demo-row--ask">
          <span className="landing-demo-label">Signal</span>
          <span className="landing-demo-signal" data-risk="MODERATE">
            Be careful
          </span>
        </div>
        <div className="landing-demo-row">
          <span className="landing-demo-label">Why</span>
          <span className="landing-demo-value">{REASON}</span>
        </div>
        <div className="landing-demo-row">
          <span className="landing-demo-label">Try</span>
          <span className="landing-demo-value">
            <strong>Adjustment:</strong> {ADJUSTMENT}
            <br />
            <strong>Swap:</strong> {SWAP}
          </span>
        </div>
        <div className="landing-demo-fineprint">
          <DisclaimerLine />
        </div>
      </section>
    );
  }
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

      {/* Step 2 — Prediabetes Pal asks one clarifying question instead of guessing. */}
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
