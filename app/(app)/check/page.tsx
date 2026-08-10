import Link from "next/link";

import { DailyLoop } from "../../../components/daily-loop";
import { DemoCheckCard } from "../../../components/demo-check-card";
import { FirstRunGate } from "../../../components/first-run-gate";
import { FoodCheckForm } from "../../../components/food-check-form";
import {
  IconArrowRight,
  IconCheck,
  IconHeart,
  IconLock
} from "../../../components/icons";
import { NudgeOpenTracker } from "../../../components/nudge-open-tracker";
import { photoInputEnabled } from "../../../lib/photo-input-flag";

export const metadata = {
  title: "Check a Meal for Prediabetes — Revora",
  description:
    "Describe a meal and get a cautious educational read for the prediabetes range: the pattern, the reason, and a practical alternative when there is one.",
  alternates: { canonical: "/check" }
};

// The app's daily surface (moved here from `/` when the marketing landing
// took over the root, 2026-07-07; into the (app) shell for M2). Stays a
// focused page (decision #8) — the shell provides nav, the backbar returns
// to the dashboard.
export default function CheckPage() {
  return (
    <div className="app-content--narrow">
      <NudgeOpenTracker />
      <FirstRunGate />
      <div className="backbar">
        <Link className="backlink" href="/home">
          <IconArrowRight size={17} />
          Home
        </Link>
      </div>
        <section className="surface-card hero-card check-hero">
          <p className="hero-eyebrow">Revora</p>
          <h1 className="page-title">Check this meal</h1>
          <p className="page-copy">
            Get a cautious educational read on the meal&apos;s balance, the reason
            behind it, and one practical alternative. Type it or say it
            {photoInputEnabled() ? ", or snap a photo" : ""}.
          </p>
        </section>

        <section className="surface-card form-card">
          <FoodCheckForm />
        </section>

        <DailyLoop />

        <ul className="trust-row" data-testid="trust-strip">
          <li>
            <IconLock size={20} />
            <span>No login for your first checks.</span>
          </li>
          <li>
            <IconHeart size={20} />
            <span>When we&apos;re unsure, we say so.</span>
          </li>
          <li>
            <IconCheck size={20} />
            <span>If you ever subscribe, cancel is one tap — not an email.</span>
          </li>
        </ul>

        <DemoCheckCard />

        <footer className="page-footer">
          <Link href="/meals">My meals</Link>
          <Link href="/journey">My journey</Link>
          <Link href="/get-the-app">Get the app</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </footer>
    </div>
  );
}
