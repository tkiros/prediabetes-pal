import type { Metadata } from "next";
import Link from "next/link";

import { GuideCta } from "../cta";

export const metadata: Metadata = {
  title: "Healthy Snacks for Prediabetes — Easy Options | Revora",
  description:
    "Healthy snack ideas for prediabetes: options that pair protein or fat with fiber, snacks worth limiting, and why portion matters more than perfection.",
  alternates: { canonical: "/guides/prediabetes-snacks" }
};

// SEO target: "healthy snacks for prediabetes", "best snacks for prediabetes".
export default function SnacksGuide() {
  return (
    <>
      <section className="surface-card hero-card">
        <p className="hero-eyebrow">Prediabetes guides</p>
        <h1 className="page-title">Healthy snacks for prediabetes</h1>
        <p className="page-copy">
          The snacks that work best with prediabetes pair protein or fat with
          fiber: nuts, Greek yogurt, cheese, eggs, hummus with vegetables,
          fruit with peanut butter. Snacks built mostly from refined carbs and
          sugar — candy, pastries, chips, soda — tend to have a higher
          blood-sugar impact, especially on their own. Here is an honest,
          practical list.
        </p>
      </section>

      <section className="surface-card legal-card">
        <h2>What makes a snack a good fit?</h2>
        <p>
          Three questions cover most of it. Does it bring protein or fat, not
          just carbs? Does it bring fiber? Is the portion a snack, not a
          second dinner? A snack does not have to pass all three — an apple on
          its own is still a fine snack — but the more it leans on refined
          carbs alone, the more it behaves like dessert.
        </p>
      </section>

      <section className="surface-card legal-card">
        <h2>Easy snacks to keep on hand</h2>
        <ul>
          <li>A small handful of almonds, walnuts, pistachios, or mixed nuts.</li>
          <li>Plain Greek yogurt — add berries or cinnamon rather than buying pre-sweetened cups.</li>
          <li>String cheese or a slice of cheese with a few whole-grain crackers.</li>
          <li>Hard-boiled eggs.</li>
          <li>Hummus with carrots, cucumber, peppers, or celery.</li>
          <li>An apple or pear with peanut or almond butter.</li>
          <li>Edamame, salted in the pod.</li>
          <li>Cottage cheese with tomato and pepper, or with a little fruit.</li>
          <li>A small portion of last night&apos;s protein — cold chicken counts.</li>
          <li>Roasted chickpeas.</li>
          <li>Tuna or sardines on a couple of whole-grain crackers.</li>
          <li>Half an avocado with salt and lemon.</li>
          <li>Celery with peanut butter.</li>
          <li>Plain popcorn in a modest bowl — fiber, just watch the portion.</li>
          <li>Dark chocolate, a square or two, ideally with nuts.</li>
        </ul>
      </section>

      <section className="surface-card legal-card">
        <h2>Which snacks are worth limiting?</h2>
        <p>
          Nothing is banned — but sugary drinks, candy, pastries, sweetened
          granola bars, and big bags of chips are the snacks that most often
          lean almost entirely on refined carbs and sugar. If you want one,
          a smaller portion alongside some protein sits easier than the same
          snack alone. That is a pattern to lean on, not a rule to obsess
          over.
        </p>
        <p>
          For how snacks fit into a whole day of eating, see the{" "}
          <Link href="/guides/prediabetes-meal-plan">
            7-day prediabetes meal plan example
          </Link>
          .
        </p>
      </section>

      <GuideCta label="Check a snack now" />
    </>
  );
}
