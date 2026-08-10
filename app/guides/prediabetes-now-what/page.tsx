import type { Metadata } from "next";
import Link from "next/link";

import { GuideCta } from "../cta";

export const metadata: Metadata = {
  title: "Prediabetes: Now What? Calm First Steps | Revora",
  description:
    "Your A1C came back between 5.7% and 6.4%. What prediabetes means, why it is not an emergency, and the calm, concrete first steps worth taking.",
  alternates: { canonical: "/guides/prediabetes-now-what" }
};

// SEO target: "i am prediabetic now what", "i am prediabetic what can i do",
// "almost prediabetic". This is the ICP's day-one search — the tone matters
// more here than anywhere: calm, candid, steady.
export default function NowWhatGuide() {
  return (
    <>
      <section className="surface-card hero-card">
        <p className="hero-eyebrow">Prediabetes guides</p>
        <h1 className="page-title">
          Your A1C is in the prediabetes range — now what?
        </h1>
        <p className="page-copy">
          An A1C between 5.7% and 6.4% is a signal, not a sentence. It is
          common, it comes with real room to act, and the acting mostly
          happens in ordinary places: your plate, your week, your next
          appointment. Here is a calm way to start.
        </p>
      </section>

      <section className="surface-card legal-card">
        <h2>Is this an emergency?</h2>
        <p>
          No. It is information — and it usually arrives with one vague line
          of advice and no manual. Prediabetes means your average blood sugar
          over the last few months sat above the typical range and below the
          range clinicians use when evaluating Type 2 diabetes. What happens
          next varies from person to person, which is exactly why the next
          step is a conversation, not a panic.
        </p>
      </section>

      <section className="surface-card legal-card">
        <h2>What are sensible first steps?</h2>
        <ul>
          <li>
            Talk with your doctor about what your number means for you, and
            when to test again. One result is a data point, not the whole
            story — our guide to{" "}
            <Link href="/guides/a1c-5-7-to-6-4">
              the 5.7% to 6.4% range
            </Link>{" "}
            explains how to read it.
          </li>
          <li>
            Look at your ordinary week of food, not a fantasy one. The
            highest-leverage change for most people is the pattern: more
            protein, vegetables, and fiber, fewer refined carbs and sugary
            drinks. The{" "}
            <Link href="/guides/what-to-eat-with-prediabetes">
              what-to-eat guide
            </Link>{" "}
            and the{" "}
            <Link href="/guides/prediabetes-meal-plan">
              7-day meal plan example
            </Link>{" "}
            make that concrete.
          </li>
          <li>
            Move a little after meals when you can — even a short walk. Your
            clinician can tell you what amount of activity makes sense for
            you.
          </li>
          <li>
            Skip the crash-diet instinct. Sustainable beats dramatic, and
            nothing about this range requires eating perfectly by Friday.
          </li>
        </ul>
      </section>

      <section className="surface-card legal-card">
        <h2>Where does Revora fit?</h2>
        <p>
          The hard part of &ldquo;eat better&rdquo; is the moment of an
          actual meal —
          the dinner table, the grocery aisle, the menu. Revora is a meal
          checker built only for prediabetes: describe the meal and get a
          cautious educational read on its balance, the reason behind it, and
          a practical alternative when there is one. You stay the one making
          the call; Revora&apos;s job is to replace the guessing.
        </p>
      </section>

      <GuideCta label="Check your next meal" />
    </>
  );
}
