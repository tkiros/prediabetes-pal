import type { ReactNode } from "react";

import { AppNav } from "../../components/app-nav";
import { IconCheck } from "../../components/icons";
import { PlanBox } from "../../components/plan-box";
import { getPlanBox } from "../../lib/server/plan-box";

/**
 * The (app) shell (M1 dashboard plan; C7 four-jobs restructure 2026-07-21).
 * Nested inside the root layout — NEVER a second root layout (route-group
 * remount footgun). Below 1024px: top bar (brand only) + fixed bottom tab bar
 * (Home · My meals · Check · My journey · Account, still no hamburger); from
 * 1024px: fixed sidebar with the same five links + plan box. The inactive nav
 * wrapper is display:none at each breakpoint, so only one nav landmark exists
 * in the accessibility tree at a time. Route-group pages keep their URLs.
 */
export default async function AppShellLayout({
  children
}: Readonly<{ children: ReactNode }>) {
  const planBox = await getPlanBox();

  return (
    <div className="app-root">
      <a href="#app-content" className="app-skip">
        Skip to content
      </a>

      <aside className="app-sidebar">
        <div className="app-brand">
          <span className="app-brand-mark">
            <IconCheck size={17} />
          </span>
          <span>Prediabetes Pal</span>
        </div>
        <AppNav variant="sidebar" />
        <div className="app-sidebar-foot">
          <PlanBox data={planBox} />
        </div>
      </aside>

      <header className="app-topbar">
        <div className="app-brand">
          <span className="app-brand-mark">
            <IconCheck size={17} />
          </span>
          <span>Prediabetes Pal</span>
        </div>
      </header>

      <main className="app-content" id="app-content" tabIndex={-1}>
        {children}
      </main>

      <div className="app-tabbar">
        <AppNav variant="tabbar" />
      </div>
    </div>
  );
}
