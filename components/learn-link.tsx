"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { track, type AnalyticsEvent } from "../lib/client/analytics";

type LearnOpened = Extract<AnalyticsEvent, { name: "learn_opened" }>["props"];

const PAGES = ["numbers", "first-week", "doctor"] as const;

/** "/learn/first-week#note" → "first-week"; the bare "/learn" is the index. */
export function learnPage(href: string): LearnOpened["page"] {
  const slug = href.split(/[?#]/)[0]?.split("/")[2];
  return PAGES.find((page) => page === slug) ?? "index";
}

/**
 * A link into /learn/ that reports where it was opened from (ruling F-38).
 * A client leaf, so the server-rendered DashboardView stays a server tree.
 */
export function LearnLink({
  href,
  from,
  className,
  children
}: {
  href: string;
  from: LearnOpened["from"];
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => track({ name: "learn_opened", props: { page: learnPage(href), from } })}
    >
      {children}
    </Link>
  );
}
