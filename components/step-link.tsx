"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { recordStepEvent, type StepEvent } from "../lib/client/orientation-progress";

/**
 * Home's step line where a tap completes the step (review A-84). A client
 * leaf, like LearnLink (ruling F-38), so the server-rendered DashboardView
 * stays a server tree.
 */
export function StepLink({
  href,
  event,
  children
}: {
  href: string;
  event: StepEvent;
  children: ReactNode;
}) {
  return (
    <Link href={href} onClick={() => void recordStepEvent(event)}>
      {children}
    </Link>
  );
}
