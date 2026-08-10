import type { Metadata } from "next";
import Link from "next/link";

import { GuideCta } from "../cta";

export const metadata: Metadata = {
  title: "Prediabetes Meal Plan — a Simple 7-Day Example | Revora",
  description:
    "A simple 7-day prediabetes meal plan example built on the balanced-plate pattern: protein, vegetables, fiber-rich carbs in modest portions, fewer refined carbs.",
  alternates: { canonical: "/guides/prediabetes-meal-plan" }
};

// SEO target: "prediabetic meal plan", "7 day meal plan for prediabetes".
// Answer-first format: the direct answer leads, question-style H2s follow.
export default function MealPlanGuide() {
  return (
    <>
      <section className="surface-card hero-card">
        <p className="hero-eyebrow">Prediabetes guides</p>
        <h1 className="page-title">A simple 7-day prediabetes meal plan</h1>
        <p className="page-copy">
          A workable prediabetes meal plan does not need special foods. Build
          each meal around protein and nonstarchy vegetables, add fiber-rich
          carbs in modest portions, and go easy on refined carbs and sugary
          drinks. Below is a seven-day example of what that looks like with
          ordinary groceries — a pattern to borrow from, not a prescription.
        </p>
      </section>

      <section className="surface-card legal-card">
        <h2>What makes a meal plan a good fit for prediabetes?</h2>
        <p>
          The pattern matters more than any single food. Meals that lean
          heavily on refined carbs — white bread, white rice, sugary cereal,
          soda — tend to have a higher blood-sugar impact. Meals that pair
          carbs with protein, fiber, and vegetables tend to be easier to
          handle. A useful plate sketch:
        </p>
        <ul>
          <li>About half nonstarchy vegetables — salad, broccoli, peppers, green beans, cabbage.</li>
          <li>About a quarter protein — chicken, fish, eggs, tofu, beans, Greek yogurt.</li>
          <li>About a quarter carbs, favoring less refined versions — brown rice, whole-grain bread, oats, lentils, sweet potato.</li>
          <li>Water, coffee, or tea instead of sugary drinks most of the time.</li>
        </ul>
      </section>

      <section className="surface-card legal-card">
        <h2>The 7-day example</h2>
        <p>
          <strong>Day 1.</strong> Breakfast: Greek yogurt with berries and
          walnuts. Lunch: chicken salad with olive oil dressing and a slice of
          whole-grain bread. Dinner: baked salmon, roasted broccoli, small
          portion of brown rice.
        </p>
        <p>
          <strong>Day 2.</strong> Breakfast: two eggs with spinach and
          whole-grain toast. Lunch: lentil soup with a side salad. Dinner:
          chicken stir-fry heavy on vegetables, modest portion of rice.
        </p>
        <p>
          <strong>Day 3.</strong> Breakfast: oatmeal with peanut butter and
          cinnamon. Lunch: tuna and white-bean salad. Dinner: turkey chili with
          plenty of beans, topped with cheese and a spoon of sour cream.
        </p>
        <p>
          <strong>Day 4.</strong> Breakfast: cottage cheese with sliced peach
          and almonds. Lunch: leftover turkey chili. Dinner: sheet-pan chicken
          thighs with peppers, onions, and a small sweet potato.
        </p>
        <p>
          <strong>Day 5.</strong> Breakfast: veggie omelet. Lunch: whole-grain
          wrap with hummus, chicken, and lots of vegetables. Dinner: shrimp
          with zucchini noodles and a small portion of pasta mixed in.
        </p>
        <p>
          <strong>Day 6.</strong> Breakfast: Greek yogurt smoothie with frozen
          berries and chia seeds. Lunch: big salad with hard-boiled eggs,
          chickpeas, and vinaigrette. Dinner: pork tenderloin, green beans,
          roasted cauliflower.
        </p>
        <p>
          <strong>Day 7.</strong> Breakfast: whole-grain toast with avocado
          and an egg. Lunch: leftover pork with a side salad. Dinner: homemade
          tacos on corn tortillas with beans, lettuce, salsa, and cheese.
        </p>
      </section>

      <section className="surface-card legal-card">
        <h2>How do I adapt it?</h2>
        <p>
          Swap in what you actually eat. The plan is a shape — protein plus
          vegetables plus a modest, less-refined carb — and almost any cuisine
          fits it. Portions vary by person, budget, and appetite, and a
          registered dietitian can tailor them to you. Blank days and takeout
          nights are normal; one meal never decides the week.
        </p>
        <p>
          Between meals, see our guide to{" "}
          <Link href="/guides/prediabetes-snacks">
            healthy snacks for prediabetes
          </Link>
          . And when a specific plate has you unsure at the moment of eating,
          that is the exact question Revora answers.
        </p>
      </section>

      <GuideCta label="Check tonight's meal" />
    </>
  );
}
