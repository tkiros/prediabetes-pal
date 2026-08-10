import type { Metadata } from "next";
import Link from "next/link";

import { GuideCta } from "../cta";

export const metadata: Metadata = {
  title: "A1C 5.7% to 6.4% — What the Prediabetes Range Means | Revora",
  description:
    "What an A1C between 5.7% and 6.4% means: how the test works, how clinicians read the prediabetes range, and why one number is not the whole story.",
  alternates: { canonical: "/guides/a1c-5-7-to-6-4" }
};

// SEO target: "a1c 5.7", "a1c 6.4", "prediabetic range", "5.7 blood sugar".
// Hard boundary notes for this page: A1C percentages only — no lab-unit
// numbers, and range meanings phrased as what clinicians use, mirroring the
// approved boundary copy in lib/revora/boundary-copy.ts.
export default function A1cRangeGuide() {
  return (
    <>
      <section className="surface-card hero-card">
        <p className="hero-eyebrow">Prediabetes guides</p>
        <h1 className="page-title">
          What an A1C between 5.7% and 6.4% means
        </h1>
        <p className="page-copy">
          A1C is a blood test that reflects your average blood sugar over
          roughly the past three months. Clinicians typically read results
          below 5.7% as within the usual range, 5.7% to 6.4% as the
          prediabetes range, and 6.5% or above as the range they use when
          evaluating Type 2 diabetes. If your number landed in the middle
          band, here is how to think about it.
        </p>
      </section>

      <section className="surface-card legal-card">
        <h2>What does the test actually measure?</h2>
        <p>
          A1C measures the share of hemoglobin in your blood that has sugar
          attached to it. Because red blood cells live for about three months,
          the result works like a long-exposure photograph of your blood
          sugar — steadier than any single finger-stick, and blind to
          day-to-day swings. That steadiness is why it is the number your
          doctor keeps coming back to.
        </p>
      </section>

      <section className="surface-card legal-card">
        <h2>Is 5.7% very different from 6.4%?</h2>
        <p>
          The range has a floor and a ceiling, and where you sit in it is
          worth knowing. A 5.7% sits just past the usual range; a 6.4% sits
          just under the ceiling. But the bands are conventions for reading a
          continuous number, not cliffs — and A1C results can vary a little
          between labs and between draws. That is one reason clinicians
          usually look at more than one result, over time, before drawing
          conclusions.
        </p>
      </section>

      <section className="surface-card legal-card">
        <h2>Why is one number not the whole story?</h2>
        <p>
          A single A1C says nothing about your kitchen, your habits, or your
          direction of travel. Two people with the same 6.0% can be in very
          different places. Your doctor reads the number alongside the rest of
          your health picture and tells you when to test again — that
          conversation, not the decimal, is the real next step. Our{" "}
          <Link href="/guides/prediabetes-now-what">now-what guide</Link>{" "}
          covers calm first moves.
        </p>
      </section>

      <section className="surface-card legal-card">
        <h2>What can I do while I wait to retest?</h2>
        <p>
          The part of the picture you touch every day is food. The pattern
          that helps most people is unglamorous: protein and vegetables at
          the center of the plate, fiber-rich carbs in modest portions,
          fewer refined carbs and sugary drinks — laid out concretely in the{" "}
          <Link href="/guides/prediabetes-meal-plan">
            7-day meal plan example
          </Link>{" "}
          and the{" "}
          <Link href="/guides/what-to-eat-with-prediabetes">
            what-to-eat guide
          </Link>
          . And at the moment a specific meal has you unsure, Revora gives
          you a cautious educational read in about ten seconds.
        </p>
      </section>

      <GuideCta />
    </>
  );
}
