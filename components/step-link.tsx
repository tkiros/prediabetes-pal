"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { track } from "../lib/client/analytics";
import { recordStepEvent, STEP_LINK_EVENTS } from "../lib/client/orientation-progress";
import type { LinkedStepId } from "../lib/coach/orientation";
import { learnPage } from "./learn-link";

/**
 * Home's step line for a step its own link completes (review A-84, ruling
 * F-54: steps 1 and 7). A client leaf, like LearnLink (ruling F-38), so the
 * server-rendered DashboardView stays a server tree. Ruling F-55: an href
 * under /learn/ also reports learn_opened, exactly as LearnLink does, so
 * moving step 1's link there (F-NUMBERS) keeps that read.
 */
export function StepLink({
  href,
  step,
  children
}: {
  href: string;
  step: LinkedStepId;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={() => {
        void recordStepEvent(STEP_LINK_EVENTS[step]);
        if (href.startsWith("/learn/")) {
          track({ name: "learn_opened", props: { page: learnPage(href), from: "step" } });
        }
      }}
    >
      {children}
    </Link>
  );
}
