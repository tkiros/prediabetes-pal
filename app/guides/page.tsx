import type { Metadata } from "next";
import Link from "next/link";

import { GuideCta } from "./cta";

export const metadata: Metadata = {
  title: "Prediabetes Guides — Meal Plans & What to Eat | Revora",
  description:
    "Plain-language guides for eating with prediabetes: a 7-day meal plan example, snack ideas, what to eat and what to limit, and what an A1C of 5.7% to 6.4% means.",
  alternates: { canonical: "/guides" }
};

const GUIDES = [
  {
    href: "/guides/prediabetes-meal-plan",
    title: "A simple 7-day prediabetes meal plan",
    blurb: "A week of ordinary meals built on the balanced-plate pattern."
  },
  {
    href: "/guides/prediabetes-snacks",
    title: "Healthy snacks for prediabetes",
    blurb: "Easy snack ideas, and the pattern that makes a snack a good fit."
  },
  {
    href: "/guides/what-to-eat-with-prediabetes",
    title: "What to eat with prediabetes",
    blurb: "What you can eat freely, what is worth limiting, and breakfast."
  },
  {
    href: "/guides/prediabetes-now-what",
    title: "Your A1C is in the prediabetes range — now what?",
    blurb: "Calm first steps after a 5.7% to 6.4% result."
  },
  {
    href: "/guides/a1c-5-7-to-6-4",
    title: "What an A1C of 5.7% to 6.4% means",
    blurb: "How to read the number, and why one test is not the whole story."
  }
] as const;

export default function GuidesIndexPage() {
  return (
    <>
      <section className="surface-card hero-card">
        <p className="hero-eyebrow">Prediabetes guides</p>
        <h1 className="page-title">Guides for eating with prediabetes</h1>
        <p className="page-copy">
          Plain-language answers to the questions people ask after an A1C
          between 5.7% and 6.4%: what to eat, what to limit, and how to think
          about the number itself. General education, written to the same
          careful standard as the app — no hype, no promises.
        </p>
      </section>
      <section className="surface-card legal-card">
        <h2>Start here</h2>
        <ul>
          {GUIDES.map(({ href, title, blurb }) => (
            <li key={href}>
              <Link href={href}>{title}</Link> — {blurb}
            </li>
          ))}
        </ul>
      </section>
      <GuideCta />
    </>
  );
}
