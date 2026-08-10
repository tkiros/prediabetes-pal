import type { Metadata } from "next";
import Link from "next/link";

import { GuideCta } from "../cta";

export const metadata: Metadata = {
  title: "What to Eat with Prediabetes — and What to Limit | Revora",
  description:
    "What you can eat with prediabetes: the foods you can enjoy freely, what is worth limiting, breakfast ideas, and how to handle eating out.",
  alternates: { canonical: "/guides/what-to-eat-with-prediabetes" }
};

// SEO target: "what to eat with prediabetes", "prediabetes what not to eat",
// "best breakfast for prediabetes". Permission-first, like every Revora
// surface: lead with what the reader CAN eat.
export default function WhatToEatGuide() {
  return (
    <>
      <section className="surface-card hero-card">
        <p className="hero-eyebrow">Prediabetes guides</p>
        <h1 className="page-title">What can you eat with prediabetes?</h1>
        <p className="page-copy">
          Most food is still on the table. With prediabetes, the useful move
          is a shift in pattern, not a list of forbidden foods: more protein,
          vegetables, and fiber; fewer refined carbs and sugary drinks; and
          portions that match a meal rather than a feast. Here is how that
          plays out across a real day.
        </p>
      </section>

      <section className="surface-card legal-card">
        <h2>What can I eat freely?</h2>
        <ul>
          <li>Nonstarchy vegetables — salad greens, broccoli, peppers, tomatoes, cucumber, cabbage, green beans, mushrooms.</li>
          <li>Proteins — chicken, turkey, fish, eggs, tofu, tempeh, plain Greek yogurt, cottage cheese.</li>
          <li>Beans and lentils — protein and fiber in the same bite.</li>
          <li>Nuts and seeds, in handful-sized portions.</li>
          <li>Whole fruit — an apple, a pear, a bowl of berries.</li>
          <li>Water, sparkling water, coffee, and tea without sugar.</li>
        </ul>
      </section>

      <section className="surface-card legal-card">
        <h2>What is worth limiting?</h2>
        <p>
          The foods that lean almost entirely on refined carbs and sugar tend
          to have the highest blood-sugar impact: soda and sweetened coffee
          drinks, candy, pastries, white bread, sugary cereal, and juice —
          juice acts more like soda than like fruit. Limiting is not
          banning: a smaller portion, eaten alongside protein or vegetables,
          usually sits easier than the same food alone.
        </p>
      </section>

      <section className="surface-card legal-card">
        <h2>What is a good breakfast for prediabetes?</h2>
        <p>
          Breakfast is where refined carbs dominate by default — cereal,
          toast, juice, pastries. The easy upgrade is to put protein at the
          center: eggs any style, Greek yogurt with berries and nuts, cottage
          cheese with fruit, oatmeal with peanut butter, or whole-grain toast
          with avocado and an egg. Coffee is fine; the sugar and syrup in it
          are where drinks quietly turn into desserts.
        </p>
      </section>

      <section className="surface-card legal-card">
        <h2>What about eating out and takeout?</h2>
        <p>
          The same pattern travels: pick a protein-forward main, ask for extra
          vegetables, and let the refined-carb side be small rather than
          bottomless. One restaurant meal never decides your week. When a
          specific menu item has you second-guessing, a{" "}
          <Link href="/check">quick check</Link> gives you a calm read in
          about ten seconds — that moment is exactly what Revora is for.
        </p>
        <p>
          Planning whole days rather than single plates? Start with the{" "}
          <Link href="/guides/prediabetes-meal-plan">
            7-day meal plan example
          </Link>{" "}
          and the{" "}
          <Link href="/guides/prediabetes-snacks">snack guide</Link>.
        </p>
      </section>

      <GuideCta />
    </>
  );
}
