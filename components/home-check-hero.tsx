"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { IconArrowRight } from "./icons";

/**
 * Action-first Home hero (approved direction 2026-07-19, "Spruce Bento"
 * composite): the meal check IS the dashboard's first task, not a link to it.
 *
 * Deliberately a hand-off, not a second check surface: the typed meal rides
 * the existing `pal.recheck` sessionStorage prefill that /check already
 * reads, so /check stays the ONE place a check runs (taster gate, A1C,
 * voice/photo, result rendering — none of it duplicated here). An empty
 * submit behaves exactly like the old CTA link.
 */
export function HomeCheckHero() {
  const router = useRouter();
  const [meal, setMeal] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = meal.trim();
    if (trimmed) {
      try {
        window.sessionStorage.setItem("pal.recheck", trimmed);
      } catch {
        // best-effort prefill only — /check works without it
      }
    }
    router.push("/check");
  }

  return (
    <section className="meal-hero" aria-labelledby="meal-hero-title">
      <p className="meal-hero-eyebrow">Meal check</p>
      <h2 id="meal-hero-title">What are you eating?</h2>
      <p className="meal-hero-copy">
        Type it or say it. Get one clear food signal.
      </p>
      <form className="meal-hero-form" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="hero-meal">
          Meal to check
        </label>
        <input
          id="hero-meal"
          name="meal"
          className="meal-hero-input"
          value={meal}
          onChange={(event) => setMeal(event.target.value)}
          placeholder="Example: oatmeal with walnuts"
          autoComplete="off"
          enterKeyHint="go"
        />
        <button
          type="submit"
          className="meal-hero-button"
          data-testid="dash-check-cta"
        >
          Check meal
          <IconArrowRight size={18} />
        </button>
      </form>
    </section>
  );
}
