"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { DisclaimerLine } from "../../../components/disclaimer-line";
import { SavedMealsSection } from "../../../components/saved-meals-section";
import { historyStore, type StoredCheck } from "../../../lib/client/history-store";
import {
  deleteHistoryCheck,
  fetchHistoryPage,
  loadHistory,
  type HistoryMeta,
  type ServerCheck
} from "../../../lib/client/remote-history";
import { dayKeyLocal as localDayKey, verdictWeekView } from "../../../lib/coach/days";
import { RISK_LABELS } from "../../../lib/pal/labels";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Only the non-default methods are worth surfacing; "text" is the norm and would
// be noise on every row.
const METHOD_LABEL: Partial<Record<StoredCheck["inputMethod"], string>> = {
  voice: "Voice",
  photo: "Photo"
};

type ViewStatus = "loading" | "guest" | "ready" | "error";

export default function HistoryPage() {
  const router = useRouter();

  const [status, setStatus] = useState<ViewStatus>("loading");
  const [checks, setChecks] = useState<ServerCheck[]>([]);
  // The week strip is a fixed 7-day at-a-glance view (pre-T9 behavior). It has
  // its OWN 7-day source rather than reading the paginated 25-row page: a first
  // page can span far more than a week (so the strip would miss recent days) or
  // fewer than 7 days (so it would look empty). Kept separate from `checks` (U7).
  const [weekChecks, setWeekChecks] = useState<StoredCheck[]>([]);
  const [meta, setMeta] = useState<HistoryMeta | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);

  // Applied filters (what the current list reflects) vs. the input drafts.
  const [queryDraft, setQueryDraft] = useState("");
  const [fromDraft, setFromDraft] = useState("");
  const [toDraft, setToDraft] = useState("");
  const [applied, setApplied] = useState<{
    q: string;
    from: string;
    to: string;
  }>({ q: "", from: "", to: "" });
  const [searchNote, setSearchNote] = useState<string | null>(null);

  const loadFirstPage = useCallback(
    async (filters: { q: string; from: string; to: string }) => {
      setStatus("loading");
      const result = await fetchHistoryPage({
        q: filters.q || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined
      });

      if (result.status === "guest") {
        // Signed-out: the on-device local store is the only history there is,
        // and "on this device" is the honest description for a guest.
        setChecks(
          historyStore.all().map((check) => ({ ...check, id: check.clientId }))
        );
        setNextCursor(null);
        setStatus("guest");
        return;
      }
      if (result.status === "error") {
        setStatus("error");
        return;
      }

      setChecks(result.checks);
      setMeta(result.meta);
      setNextCursor(result.nextCursor);
      setSearchNote(
        filters.q && result.searchCapped
          ? `Searched your ${result.searchScanned} most recent checks.`
          : null
      );
      setStatus("ready");
    },
    []
  );

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadFirstPage({ q: "", from: "", to: "" });
    }, 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadFirstPage]);

  // Fixed 7-day source for the week strip, independent of the paginated list.
  // loadHistory falls back to the on-device store for guests/outages, so the
  // strip stays honest without its own error surface.
  const loadWeek = useCallback(async () => {
    const result = await loadHistory(7);
    setWeekChecks(result.checks);
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadWeek();
    }, 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadWeek]);

  async function onLoadMore() {
    if (!nextCursor || loadingMore) {
      return;
    }
    setLoadingMore(true);
    setLoadMoreError(false);
    // Load more only runs for the paginated (non-search) view; searching yields
    // a single bounded result with no cursor.
    const result = await fetchHistoryPage({
      cursor: nextCursor,
      from: applied.from || undefined,
      to: applied.to || undefined
    });
    if (result.status === "ok") {
      setChecks((prev) => [...prev, ...result.checks]);
      setNextCursor(result.nextCursor);
    } else {
      // Keep the cursor so Retry works; surface a non-destructive inline error.
      setLoadMoreError(true);
    }
    setLoadingMore(false);
  }

  function onApplyFilters(event: React.FormEvent) {
    event.preventDefault();
    const filters = {
      q: queryDraft.trim(),
      from: fromDraft,
      to: toDraft
    };
    setApplied(filters);
    void loadFirstPage(filters);
  }

  function onClearFilters() {
    setQueryDraft("");
    setFromDraft("");
    setToDraft("");
    setApplied({ q: "", from: "", to: "" });
    void loadFirstPage({ q: "", from: "", to: "" });
  }

  async function onDelete(check: ServerCheck) {
    const confirmed = window.confirm(`Delete this check (${check.food})?`);
    if (!confirmed) {
      return;
    }
    const ok = await deleteHistoryCheck(check.id);
    if (ok) {
      // Deletion is real (plan §16 / privacy finding E1): drop the on-device
      // copy too, or the daily-loop `syncLocalHistory` re-migrates it on the
      // next visit and resurrects the row the user just deleted.
      historyStore.remove(check.clientId);
      setChecks((prev) => prev.filter((c) => c.id !== check.id));
      setWeekChecks((prev) => prev.filter((c) => c.clientId !== check.clientId));
    } else {
      window.alert("Could not delete that check. Please try again.");
    }
  }

  function recheck(food: string) {
    try {
      window.sessionStorage.setItem("pal.recheck", food);
    } catch {
      // best-effort prefill only
    }
    router.push("/check");
  }

  const isServer = status === "ready" || status === "guest";
  const isPremium = meta?.tier === "premium";
  const hasFilters = Boolean(applied.q || applied.from || applied.to);

  const weekStrip = verdictWeekView(weekChecks, localDayKey).map((day) => ({
    ...day,
    label: DAY_LABELS[new Date(`${day.key}T00:00:00`).getDay()]
  }));

  return (
    <div className="app-content--narrow">
      <section className="surface-card hero-card">
        <p className="hero-eyebrow">What worked for you</p>
        <h1 className="page-title">My meals</h1>
        <p className="page-copy">
          {status === "loading"
            ? "Loading your meals…"
            : status === "error"
              ? "We could not reach your checks just now."
              : status === "guest"
                ? "The checks you've made on this device. Sign in to keep them synced across every device."
                : isPremium
                  ? "Everything you've checked and saved, synced to your account."
                  : "Your recent checks, synced to your account."}
        </p>

        {status !== "error" && !hasFilters && (
          <ol className="week-strip" data-testid="week-strip">
            {weekStrip.map((day) => (
              <li
                key={day.key}
                className="week-day"
                data-checked={day.checked || undefined}
              >
                <span className="week-day-label">{day.label}</span>
                <span
                  aria-hidden="true"
                  className={day.checked ? "week-dot week-dot-on" : "week-dot"}
                  data-risk={day.risk}
                />
                <span className="sr-only">
                  {day.checked ? "checked in" : "no checks"}
                </span>
              </li>
            ))}
          </ol>
        )}

        {status === "ready" && !isPremium && (
          <p className="field-hint" data-testid="free-retention-note">
            Free accounts keep 7 days of history visible.{" "}
            <Link className="inline-link" href="/subscribe">
              Go premium
            </Link>{" "}
            to see and search your full history on every device.
          </p>
        )}
      </section>

      {status === "error" && (
        <section className="surface-card hero-card" data-testid="history-error">
          <h2 className="section-title">History is unavailable</h2>
          <p className="page-copy">
            This is a temporary problem on our side, not a limit on your account.
            Your checks are safe.
          </p>
          <button
            type="button"
            className="recheck-button"
            onClick={() => void loadFirstPage(applied)}
          >
            Try again
          </button>
        </section>
      )}

      {status === "ready" && (
        <section className="surface-card hero-card">
          <form className="history-filters" onSubmit={onApplyFilters}>
            <div className="field-stack">
              <label className="field-label" htmlFor="history-search">
                Search your checks
              </label>
              <input
                id="history-search"
                className="text-input"
                type="search"
                placeholder="e.g. oatmeal"
                value={queryDraft}
                onChange={(event) => setQueryDraft(event.target.value)}
              />
            </div>
            <div className="history-filters-dates">
              <div className="field-stack">
                <label className="field-label" htmlFor="history-from">
                  From
                </label>
                <input
                  id="history-from"
                  className="text-input"
                  type="date"
                  value={fromDraft}
                  onChange={(event) => setFromDraft(event.target.value)}
                />
              </div>
              <div className="field-stack">
                <label className="field-label" htmlFor="history-to">
                  To
                </label>
                <input
                  id="history-to"
                  className="text-input"
                  type="date"
                  value={toDraft}
                  onChange={(event) => setToDraft(event.target.value)}
                />
              </div>
            </div>
            <div className="history-filters-actions">
              <button type="submit" className="primary-button">
                Search
              </button>
              {hasFilters && (
                <button
                  type="button"
                  className="recheck-button"
                  onClick={onClearFilters}
                >
                  Clear
                </button>
              )}
              <a
                className="recheck-button"
                href="/api/history/export"
                download
                data-testid="history-export"
              >
                Export
              </a>
            </div>
          </form>
        </section>
      )}

      {status === "ready" ? <SavedMealsSection /> : null}

      {isServer && (
        <section className="surface-card hero-card">
          <h2 className="section-title">
            {hasFilters ? "Matching checks" : "Recent checks"}
          </h2>
          {searchNote && <p className="field-hint">{searchNote}</p>}

          {checks.length === 0 ? (
            <div className="empty-state" data-testid="history-empty">
              <p>
                {hasFilters
                  ? "No checks match those filters."
                  : "Nothing here yet. Check your next meal and it will show up on this page."}
              </p>
              {!hasFilters && (
                <Link className="recheck-button link-button" href="/check">
                  Check a meal
                </Link>
              )}
            </div>
          ) : (
            <>
              <ul className="history-list" data-testid="history-list">
                {checks.map((check) => (
                  <li
                    key={check.id}
                    className="history-item"
                    data-risk={check.risk}
                  >
                    <div className="history-item-main">
                      <span className="today-food">{check.food}</span>
                      <span className="today-risk" data-risk={check.risk}>
                        {RISK_LABELS[check.risk]}
                      </span>
                    </div>
                    <div className="history-item-meta">
                      <span className="history-time">
                        {new Date(check.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit"
                        })}
                        {METHOD_LABEL[check.inputMethod]
                          ? ` · ${METHOD_LABEL[check.inputMethod]}`
                          : ""}
                      </span>
                      <span className="history-item-buttons">
                        <button
                          type="button"
                          className="recheck-button"
                          data-testid="recheck-button"
                          onClick={() => recheck(check.food)}
                        >
                          Check again
                        </button>
                        {status === "ready" && (
                          <button
                            type="button"
                            className="recheck-button"
                            data-testid="delete-button"
                            onClick={() => void onDelete(check)}
                          >
                            Delete
                          </button>
                        )}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              {status === "ready" && nextCursor && (
                <div className="history-load-more">
                  <button
                    type="button"
                    className="recheck-button link-button"
                    data-testid="load-more"
                    onClick={() => void onLoadMore()}
                    disabled={loadingMore}
                  >
                    {loadingMore
                      ? "Loading…"
                      : loadMoreError
                        ? "Couldn't load more — Retry"
                        : "Load more"}
                  </button>
                  {loadMoreError && (
                    <p className="field-hint" data-testid="load-more-error">
                      Something went wrong loading more checks. Your history is
                      safe — try again.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {status === "guest" && (
            <p className="field-hint">
              <Link className="inline-link" href="/welcome">
                Sign in
              </Link>{" "}
              to keep your history on every device, search it, and export it.
            </p>
          )}
        </section>
      )}

      <DisclaimerLine />

      <footer className="page-footer">
        <Link href="/home">Home</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </footer>
    </div>
  );
}
