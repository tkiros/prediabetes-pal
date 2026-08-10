"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { routeA1C } from "../../../lib/pal/a1c";
// Single source of A1C boundary + disclaimer copy (SAFETY-OWNED). Onboarding is
// a client component and cannot read the ledger from disk, so it imports the
// canonical literals instead of retyping them (which is how they once drifted).
import {
  BELOW_RANGE_MESSAGE,
  BOUNDARY_DISCLAIMER,
  HIGH_RANGE_MESSAGE
} from "../../../lib/pal/boundary-copy";
import { RISK_LABELS } from "../../../lib/pal/labels";
import { promotedInputsFor } from "../../../lib/pal/promise-registry";
import { track } from "../../../lib/client/analytics";
import {
  storedUtmChannel,
  type Channel
} from "../../../lib/client/attribution";
import { profileStore } from "../../../lib/client/profile-store";
import { IconAlert, IconCheck, IconPause } from "../../../components/icons";

type Step =
  | "welcome"
  | "segment"
  | "attribution"
  | "a1c"
  | "expectations"
  | "first_check"
  | "boundary";

// Segmentation prompt — one tap, kept on-device only (no server write). The
// answer picks which three first-check foods step 5 suggests, so the tour
// actually listens. Segmentation analytics is a post-launch YAGNI.
const SEGMENT_CHIPS = [
  "New A1C result",
  "Doctor's advice",
  "Family history",
  "Just checking"
] as const;

type Segment = (typeof SEGMENT_CHIPS)[number];

// Attribution question (§0.2 #6 — distinct from the segment step above; that
// one asks WHY they came, this one asks WHERE FROM). One tap, sent only as a
// closed-enum analytics event — never free text, never stored server-side.
const ATTRIBUTION_CHIPS: ReadonlyArray<{ label: string; channel: Channel }> = [
  { label: "Reddit", channel: "reddit" },
  { label: "TikTok, Reels, or Shorts", channel: "video" },
  { label: "Facebook", channel: "facebook" },
  { label: "Search", channel: "search" },
  { label: "A friend or family", channel: "friend" },
  { label: "Somewhere else", channel: "other" }
];

// The guided-first-check foods — everyday items whose impact surprises almost
// everyone, so the very first check earns an "oh, huh" moment. Varied by what
// brought the user here; the classics are the default. Derived from the promise
// registry (the single source for every PROMOTED example) so the tour and the
// landing demo can never drift — and so the deploy-blocking fixture test guards
// that each classic still takes the route the tour implies.
const FIRST_CHECK_CLASSICS = promotedInputsFor("onboarding");
export const FIRST_CHECK_CHIPS_BY_SEGMENT: Record<
  Segment,
  readonly string[]
> = {
  "New A1C result": FIRST_CHECK_CLASSICS,
  "Doctor's advice": ["brown rice", "granola", "fruit smoothie"],
  "Family history": ["white bread", "grapes", "sweet tea"],
  "Just checking": FIRST_CHECK_CLASSICS
};

// Goal-gradient bar: never starts at zero — arriving counts as progress
// (car-wash stamp study). Boundary is an exit, not a step, so it hides the bar.
export const STEP_PROGRESS: Record<Step, number> = {
  welcome: 20,
  segment: 40,
  attribution: 48,
  a1c: 58,
  expectations: 75,
  first_check: 90,
  boundary: 0
};

// Visible "Step X of N" text beside the goal-gradient bar. N depends on the
// user's actual path: returning guests with an on-device A1C skip the a1c
// step, so their tour is 4 steps, not 5 with a hole in the numbering. Pure so
// it is unit-testable in node without a component harness.
export function stepCounter(step: Step, skipsA1c: boolean): string {
  const steps: readonly Step[] = skipsA1c
    ? ["welcome", "segment", "attribution", "expectations", "first_check"]
    : [
        "welcome",
        "segment",
        "attribution",
        "a1c",
        "expectations",
        "first_check"
      ];
  const index = steps.indexOf(step);
  return index === -1 ? "" : `Step ${index + 1} of ${steps.length}`;
}

// Single-source rule (P3): the tour never re-asks what the device already knows.
// A guest who has an on-device A1C skips the A1C step entirely. Pure so the
// branch is unit-testable in node without a component harness.
export function nextStepAfterAttribution(hasProfile: boolean): Step {
  return hasProfile ? "expectations" : "a1c";
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [a1cText, setA1cText] = useState("");
  const [a1cError, setA1cError] = useState<string | null>(null);
  const [a1cValue, setA1cValue] = useState<number | null>(null);
  const [boundaryMessage, setBoundaryMessage] = useState("");
  const [segment, setSegment] = useState<Segment | null>(null);
  // Read after mount (not at render) so server HTML and first client paint
  // agree; a returning guest's counter settles to "of 4" before any tap.
  const [skipsA1c, setSkipsA1c] = useState(false);
  useEffect(() => {
    const skip = profileStore.get() !== null;
    const update = window.setTimeout(() => setSkipsA1c(skip), 0);
    // W-10/N-12: the top of the activation funnel. Without a *_started event
    // there is no denominator, so the onboarding drop-off — the single number
    // that decides whether the funnel works — was not computable at all.
    track({ name: "onboarding_started" });
    return () => window.clearTimeout(update);
  }, []);

  function advanceFromSegment(choice?: Segment) {
    if (choice) {
      setSegment(choice);
      try {
        window.localStorage.setItem("pal.segment.v1", choice);
      } catch {
        // best-effort — the chip choice still steers this tour
      }
    }
    setStep("attribution");
  }

  function advanceFromAttribution(choice?: Channel) {
    // Fires exactly once per tour, skip included — a skipped self-report with
    // a captured UTM is still a channel read.
    track({
      name: "attribution",
      props: { reported: choice ?? "skipped", utm: storedUtmChannel() }
    });
    setStep(nextStepAfterAttribution(profileStore.get() !== null));
  }

  const firstCheckChips = segment
    ? FIRST_CHECK_CHIPS_BY_SEGMENT[segment]
    : FIRST_CHECK_CLASSICS;

  function skipTour() {
    persistA1c();
    // 5.1's escape hatch: ?stay=1 tells FirstRunGate not to bounce the user
    // straight back into the tour, so "skip" never loops.
    router.push("/check?stay=1");
  }

  function handleA1cContinue() {
    const value = Number.parseFloat(a1cText);

    if (!Number.isFinite(value) || value < 0 || value > 20) {
      setA1cError("Enter your latest A1C with one decimal, like 6.1.");
      return;
    }

    setA1cError(null);
    const route = routeA1C(value);

    if (route.kind === "out_of_scope") {
      setBoundaryMessage(
        route.band === "below_prediabetes_range"
          ? BELOW_RANGE_MESSAGE
          : HIGH_RANGE_MESSAGE
      );
      setStep("boundary");
      return;
    }

    setA1cValue(value);
    setStep("expectations");
  }

  // Persist on every INTENTIONAL exit from the tour — the classic tap AND
  // "Skip setup and check a meal". Step 4 promises "It stays on this device",
  // so a deliberate exit must never drop the typed A1C and re-ask on /check.
  // Deliberately NOT persisted at step-4 Continue: a non-null profile is
  // FirstRunGate's only "onboarded" signal, so persisting mid-tour would mark
  // tab-close abandoners as onboarded forever (ship adversarial review,
  // Claude + Codex convergent finding).
  function persistA1c() {
    if (a1cValue !== null) {
      profileStore.set({ a1c: a1cValue, onboardedAt: new Date().toISOString() });
    }
  }

  function startGuidedCheck(food: string) {
    // Hand the chosen food to the home form via the same prefill path a
    // one-tap re-check uses (food-check-form.tsx reads + clears pal.recheck).
    try {
      window.sessionStorage.setItem("pal.recheck", food);
    } catch {
      // storage unavailable — land on the form without a prefill
    }
    persistA1c();
    track({ name: "onboarding_completed" });
    router.push("/check");
  }

  return (
    <div className="app-content--narrow">
        <section
          className="surface-card hero-card"
          data-testid="onboarding-step"
          data-step={step}
        >
          {step !== "boundary" ? (
            <>
              <p className="onboarding-step-count">
                {stepCounter(step, skipsA1c)} · about 30 seconds
              </p>
              <div
                className="onboarding-progress"
                role="progressbar"
                aria-label={`Tour progress — ${stepCounter(step, skipsA1c)}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={STEP_PROGRESS[step]}
              >
                <div
                  className="onboarding-progress-fill"
                  style={{ width: `${STEP_PROGRESS[step]}%` }}
                />
              </div>
            </>
          ) : null}
          {step === "welcome" ? (
            <>
              <p className="hero-eyebrow">Welcome to Prediabetes Pal</p>
              <h1 className="page-title">
                Check a meal. Get a cautious educational read.
              </h1>
              <p className="page-copy">
                At the moment of a meal, Prediabetes Pal gives you one cautious
                educational label — {" "}
                {RISK_LABELS.SAFE}, {RISK_LABELS.MODERATE}, or{" "}
                {RISK_LABELS.HIGH} — with one reason and, when appropriate, an
                adjustment and one practical alternative. Never a calorie,
                never a
                number to track.
              </p>
              <div className="chip-row" aria-hidden="true">
                <span className="verdict-badge" data-risk="SAFE">
                  <IconCheck size={16} />
                  {RISK_LABELS.SAFE}
                </span>
                <span className="verdict-badge" data-risk="MODERATE">
                  <IconAlert size={16} />
                  {RISK_LABELS.MODERATE}
                </span>
                <span className="verdict-badge" data-risk="HIGH">
                  <IconPause size={16} />
                  {RISK_LABELS.HIGH}
                </span>
              </div>
              <button
                type="button"
                className="primary-button"
                onClick={() => setStep("segment")}
              >
                Get started
              </button>
            </>
          ) : null}

          {step === "segment" ? (
            <>
              <p className="hero-eyebrow">One quick question</p>
              <h1 className="page-title">What brought you here?</h1>
              <div className="chip-row" role="group" aria-label="What brought you here?">
                {SEGMENT_CHIPS.map((label) => (
                  <button
                    key={label}
                    type="button"
                    className="selectable-chip"
                    onClick={() => advanceFromSegment(label)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="inline-link onboarding-skip"
                onClick={() => advanceFromSegment()}
              >
                Skip
              </button>
            </>
          ) : null}

          {step === "attribution" ? (
            <>
              <p className="hero-eyebrow">One more quick question</p>
              <h1 className="page-title">Where did you hear about us?</h1>
              <div
                className="chip-row"
                role="group"
                aria-label="Where did you hear about us?"
              >
                {ATTRIBUTION_CHIPS.map(({ label, channel }) => (
                  <button
                    key={channel}
                    type="button"
                    className="selectable-chip"
                    onClick={() => advanceFromAttribution(channel)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="inline-link onboarding-skip"
                onClick={() => advanceFromAttribution()}
              >
                Skip
              </button>
            </>
          ) : null}

          {step === "a1c" ? (
            <>
              <p className="hero-eyebrow">Your A1C</p>
              <h1 className="page-title">Your latest A1C</h1>
              <p className="page-copy">
                Prediabetes Pal is built only for the prediabetes range — an A1C of
                5.7% to 6.4%. Your number tunes how careful the answers are.
              </p>
              <div className="field-stack">
                <label htmlFor="onboarding-a1c" className="field-label">
                  Latest A1C
                </label>
                <input
                  id="onboarding-a1c"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={a1cText}
                  onChange={(event) => {
                    setA1cText(event.target.value);
                    setA1cError(null);
                  }}
                  placeholder="6.1"
                  aria-describedby={
                    a1cError ? "onboarding-a1c-error" : "onboarding-a1c-help"
                  }
                  aria-invalid={a1cError ? true : undefined}
                  className="text-input"
                />
                <p id="onboarding-a1c-help" className="field-hint">
                  Enter one decimal place, like 6.1. It stays on this device
                  unless you create an account.
                </p>
                {a1cError ? (
                  <p id="onboarding-a1c-error" className="field-error">
                    {a1cError}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="primary-button"
                onClick={handleA1cContinue}
              >
                Continue
              </button>
            </>
          ) : null}

          {step === "boundary" ? (
            <>
              <p className="hero-eyebrow">A quick heads-up</p>
              <h1 className="page-title">Prediabetes Pal isn&apos;t built for this range</h1>
              <p className="page-copy" data-testid="boundary-message">
                {boundaryMessage}
              </p>
              <p className="result-disclaimer">{BOUNDARY_DISCLAIMER}</p>
              <Link className="primary-button link-button" href="/">
                Back to the home page
              </Link>
            </>
          ) : null}

          {step === "expectations" ? (
            <>
              <p className="hero-eyebrow">How Prediabetes Pal works</p>
              <h1 className="page-title">What to expect</h1>
              <ul className="page-copy expectation-list">
                <li>
                  When we&apos;re unsure, we say so — you&apos;ll see it in the
                  result.
                </li>
                <li>
                  Guidance is qualitative — plain words, not glucose numbers
                  or calorie math.
                </li>
                {/* `general-guidance-01` ledger row — same line as the result
                    card renders. */}
                <li>
                  The labels describe general meal patterns. Your A1C range
                  only makes the presentation more cautious; it does not
                  predict your individual response.
                </li>
                <li>It is information to decide with, not medical advice.</li>
              </ul>
              <p className="result-disclaimer">{BOUNDARY_DISCLAIMER}</p>
              <button
                type="button"
                className="primary-button"
                onClick={() => setStep("first_check")}
              >
                Continue
              </button>
            </>
          ) : null}

          {step === "first_check" ? (
            <>
              <p className="hero-eyebrow">Your first check</p>
              <h1 className="page-title">Try one of the classics</h1>
              <p className="page-copy">
                Three everyday breakfast staples to start with. Tap one and
                we&apos;ll set it up on the check page — one tap more to run it.
              </p>
              <div
                className="chip-row"
                role="group"
                aria-label="Try one of the classics"
              >
                {firstCheckChips.map((food) => (
                  <button
                    key={food}
                    type="button"
                    className="selectable-chip"
                    data-testid={`first-check-${food.replace(/\s+/g, "-")}`}
                    onClick={() => startGuidedCheck(food)}
                  >
                    {food}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {step !== "boundary" ? (
            <button
              type="button"
              className="inline-link onboarding-skip-tour"
              onClick={skipTour}
            >
              Skip setup and check a meal
            </button>
          ) : null}
        </section>

        <footer className="page-footer">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </footer>
    </div>
  );
}
