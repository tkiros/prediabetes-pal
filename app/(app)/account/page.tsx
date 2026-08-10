"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";

import { resolveAccountLoadState } from "../../../lib/client/account-load-state";
import { track } from "../../../lib/client/analytics";
import { historyStore } from "../../../lib/client/history-store";
import {
  resolveNudgeSave,
  type NudgeSettings
} from "../../../lib/client/nudge-settings";
import { profileStore } from "../../../lib/client/profile-store";
import { useHydrated } from "../../../lib/client/use-hydrated";
import { SupportCaseForm } from "../../../components/support-case-form";

type EntitlementInfo = {
  tier: "free" | "premium";
  status: "trialing" | "premium" | "lapsed" | "none";
  source: "play" | "stripe" | null;
  checksToday: number;
  freeDailyLimit: number;
  // ISO string over the wire (Date on the server type).
  currentPeriodEnd: string | null;
  // BC-2: true when the subscription will not renew (canceled at period end).
  cancelAtPeriodEnd?: boolean;
};

/** 24h → friendly label, e.g. 0 → "12:00 am", 13 → "1:00 pm". */
function formatHour(hour: number): string {
  if (hour === 0) return "12:00 am";
  if (hour === 12) return "12:00 pm";
  return hour < 12 ? `${hour}:00 am` : `${hour - 12}:00 pm`;
}

export default function AccountPage() {
  const [state, setState] = useState<
    "loading" | "signed_out" | "unavailable" | "ready"
  >("loading");
  const [entitlement, setEntitlement] = useState<EntitlementInfo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nudge, setNudge] = useState<NudgeSettings | null>(null);
  const [nudgeSaved, setNudgeSaved] = useState(false);
  const [nudgeError, setNudgeError] = useState(false);
  const [canceled, setCanceled] = useState<{ accessUntil: string } | null>(
    null
  );
  const [canceling, setCanceling] = useState(false);
  const [withdrawingHealthConsent, setWithdrawingHealthConsent] = useState(false);
  const [confirmHealthWithdrawal, setConfirmHealthWithdrawal] = useState(false);
  // PR-6: per-browser analytics opt-out (Umami's localStorage kill switch).
  const hydrated = useHydrated();
  const [analyticsPreference, setAnalyticsPreference] = useState<
    boolean | null
  >(null);
  const analyticsDisabled =
    analyticsPreference ??
    (hydrated
      ? (() => {
          try {
            return window.localStorage.getItem("umami.disabled") !== null;
          } catch {
            return false;
          }
        })()
      : false);
  // Free-tier copy is mode-dependent: legacy has a real 5/day free plan, the
  // trial funnel doesn't. Default to trial (the code default) so the copy
  // never resurrects the retired free offer on a failed lookup.
  const [mode, setMode] = useState<"legacy" | "trial">("trial");
  // Checkout-return truth (Task 8 / P2.2): after a checkout, the webhook +
  // inbox may not have written the subscription row yet. Rather than flash a
  // false free/paywall state at a user who just paid, we show "access is
  // syncing" and poll /api/entitlement until premium appears.
  const [syncing, setSyncing] = useState(false);
  // Set when the 60s syncing fallback fires without premium appearing, so the
  // user gets an explicit refresh hint instead of a silent drop to free copy.
  const [syncTimedOut, setSyncTimedOut] = useState(false);
  const syncStartRef = useRef<number>(0);
  const checkoutReturnRef = useRef<{
    subscribed: boolean;
    sessionId: string | null;
  } | null>(null);
  const checkoutSideEffectsRanRef = useRef(false);

  useEffect(() => {
    fetch("/api/paywall")
      .then((response) => response.json())
      .then((data: { mode?: unknown }) => {
        if (data?.mode === "legacy") {
          setMode("legacy");
        }
      })
      .catch(() => {
        // keep the trial default
      });
  }, []);

  useEffect(() => {
    // Landing point after both checkout paths (Stripe's success_url and the
    // Play Billing verify redirect both point here with ?subscribed=1) —
    // this is the only client-side moment that knows checkout completed.
    if (checkoutReturnRef.current === null) {
      const params = new URLSearchParams(window.location.search);
      checkoutReturnRef.current = {
        subscribed: params.get("subscribed") === "1",
        sessionId: params.get("session_id"),
      };
    }

    const checkoutReturn = checkoutReturnRef.current;
    if (!checkoutReturn.subscribed) {
      return;
    }

    if (!checkoutSideEffectsRanRef.current) {
      checkoutSideEffectsRanRef.current = true;
      track({ name: "subscribe_completed" });
      // BC-3: server-side retrieve+upsert from the Checkout session id, so
      // entitlement flips even when the webhook is unregistered or delayed.
      // Fire-and-forget — the poll below picks up the row it writes.
      if (checkoutReturn.sessionId) {
        void fetch("/api/billing/stripe/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: checkoutReturn.sessionId }),
        }).catch(() => {});
      }
      syncStartRef.current = Date.now();
      // Strip the params so a refresh doesn't re-fire the event.
      window.history.replaceState(null, "", window.location.pathname);
    }

    // Enter the syncing surface after the effect commits. Caching the return
    // above keeps this StrictMode-safe even though the URL is stripped during
    // the first setup pass.
    const beginSync = window.setTimeout(() => setSyncing(true), 0);
    return () => window.clearTimeout(beginSync);
  }, []);

  // While syncing, poll the entitlement endpoint until premium appears (or we
  // give up after ~60s and let the normal state render with a gentle refresh
  // hint). The polls are tagged so the server logs the pending→recovered
  // transition (entitlement_pending / entitlement_recovered, §10.1).
  useEffect(() => {
    if (!syncing) {
      return;
    }
    let cancelled = false;
    let logged = false;

    const bucket = () => {
      const elapsed = Date.now() - syncStartRef.current;
      if (elapsed <= 60_000) return "under_60s";
      if (elapsed <= 5 * 60_000) return "under_5m";
      return "under_1h";
    };

    const poll = async () => {
      try {
        const url = logged
          ? "/api/entitlement"
          : `/api/entitlement?heal=pending&waited=${bucket()}`;
        logged = true;
        const response = await fetch(url, { cache: "no-store" });
        if (cancelled || !response.ok) {
          return;
        }
        const data = (await response.json()) as EntitlementInfo;
        if (data.tier === "premium") {
          // Recovered: record the flip (server logs the latency bucket) and
          // drop out of the syncing surface.
          void fetch(`/api/entitlement?heal=recovered&waited=${bucket()}`, {
            cache: "no-store"
          }).catch(() => {});
          if (!cancelled) {
            setEntitlement(data);
            setState("ready");
            setSyncing(false);
            setSyncTimedOut(false);
          }
        }
      } catch {
        // Transient — the next tick retries.
      }
    };

    void poll();
    const interval = setInterval(poll, 2500);
    // Bounded: stop the visual "syncing" after 60s so a genuinely stuck sync
    // falls back to the normal (accurate) state plus a refresh hint, never an
    // infinite spinner.
    const stop = setTimeout(() => {
      if (!cancelled) {
        setSyncing(false);
        setSyncTimedOut(true);
      }
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(stop);
    };
  }, [syncing]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/entitlement", { cache: "no-store" });
        if (cancelled) {
          return;
        }
        // Error-state truth: only a real 401 is signed-out; a 5xx/other error
        // is an outage, never a silent drop to free/trial plan copy.
        const loadState = resolveAccountLoadState({
          outcome: "response",
          ok: response.ok,
          status: response.status
        });
        if (loadState !== "ready") {
          setState(loadState);
          return;
        }
        let data: EntitlementInfo;
        try {
          data = (await response.json()) as EntitlementInfo;
        } catch {
          setState("unavailable");
          return;
        }
        setEntitlement(data);
        setState("ready");

        const profileResponse = await fetch("/api/profile", {
          cache: "no-store"
        });
        if (!cancelled && profileResponse.ok) {
          const profile = (await profileResponse.json()) as {
            hasProfile: boolean;
            nudgeOptIn?: boolean;
            nudgeHour?: number;
            nudgeCadence?: "daily" | "few_per_week" | "weekly";
            nudgeQuietStart?: number | null;
            nudgeQuietEnd?: number | null;
          };
          if (profile.hasProfile) {
            setNudge({
              optIn: Boolean(profile.nudgeOptIn),
              hour: profile.nudgeHour ?? 11,
              cadence: profile.nudgeCadence ?? "daily",
              quietStart: profile.nudgeQuietStart ?? null,
              quietEnd: profile.nudgeQuietEnd ?? null
            });
          }
        }
      } catch {
        if (!cancelled) {
          // Network throw → outage, not signed-out.
          setState(resolveAccountLoadState({ outcome: "network" }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function manageStripe() {
    setError(null);
    const response = await fetch("/api/billing/stripe/portal", {
      method: "POST"
    });
    const body = (await response.json()) as { url?: string; error?: string };
    if (body.url) {
      window.location.assign(body.url);
    } else {
      setError(body.error ?? "Couldn't open the billing portal.");
    }
  }

  async function patchNudge(patch: Record<string, unknown>): Promise<boolean> {
    setNudgeSaved(false);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch)
      });
      setNudgeSaved(response.ok);
      return response.ok;
    } catch {
      setNudgeSaved(false);
      return false;
    }
  }

  // Optimistic apply-or-rollback for a single reminder-field change (U9). The UI
  // shows `next` immediately; if the PATCH fails we roll back to `prior` and flag
  // it, so a field can never silently claim a value the server never stored.
  async function saveNudge(
    prior: NudgeSettings,
    next: NudgeSettings,
    patch: Record<string, unknown>
  ): Promise<void> {
    setNudge(next);
    setNudgeError(false);
    const ok = await patchNudge(patch);
    const resolved = resolveNudgeSave(prior, next, ok);
    setNudge(resolved.nudge);
    setNudgeError(resolved.failed);
  }

  async function turnOffNudges() {
    if (!nudge) {
      return;
    }
    const ok = await patchNudge({ nudgeOptIn: false });
    if (ok) {
      setNudge({ ...nudge, optIn: false });
      // §P4.3: opting out is the whole signal — no props.
      track({ name: "nudge_unsubscribed" });
    }
  }

  async function cancelSubscription() {
    setError(null);
    setCanceling(true);
    try {
      const response = await fetch("/api/billing/cancel", { method: "POST" });
      const body = (await response.json()) as {
        ok?: boolean;
        accessUntil?: string;
        error?: string;
      };
      if (body.ok && body.accessUntil) {
        setCanceled({ accessUntil: body.accessUntil });
      } else {
        setError(body.error ?? "Couldn't cancel — please try again.");
      }
    } catch {
      setError("Couldn't cancel — please try again.");
    } finally {
      setCanceling(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    setError(null);

    try {
      const response = await fetch("/api/account/delete", { method: "POST" });
      if (!response.ok) {
        setError("Deletion didn't complete — please try again.");
        setDeleting(false);
        return;
      }

      // Local copies go too — deletion means deletion.
      historyStore.clear();
      profileStore.clear();
      track({ name: "deletion_completed" });
      window.location.assign("/?deleted=1");
    } catch {
      setError("Deletion didn't complete — please try again.");
      setDeleting(false);
    }
  }

  async function withdrawHealthDataConsent() {
    setWithdrawingHealthConsent(true);
    setError(null);
    try {
      const response = await fetch("/api/account/health-data", {
        method: "DELETE"
      });
      if (!response.ok) {
        setError("Health-data deletion didn't complete — please try again.");
        return;
      }
      historyStore.clear();
      profileStore.clear();
      window.location.assign("/welcome?health-data-deleted=1");
    } catch {
      setError("Health-data deletion didn't complete — please try again.");
    } finally {
      setWithdrawingHealthConsent(false);
    }
  }

  return (
    <div className="app-content--narrow">
        <section className="surface-card hero-card">
          <p className="hero-eyebrow">Account</p>
          <h1 className="page-title">Your Prediabetes Pal account</h1>

          {state === "loading" ? (
            <p className="page-copy">Loading…</p>
          ) : state === "unavailable" ? (
            <div data-testid="account-unavailable" aria-live="polite">
              <p className="page-copy">
                We couldn&apos;t load your account just now. Your data and any
                subscription are safe — this is on our side. Try again in a
                moment.
              </p>
              <button
                type="button"
                className="primary-button"
                data-testid="account-retry"
                onClick={() => window.location.reload()}
              >
                Try again
              </button>
            </div>
          ) : state === "signed_out" ? (
            <>
              <p className="page-copy">
                You&apos;re not signed in. An account keeps your history and
                coach in sync across devices.
              </p>
              <Link className="primary-button link-button" href="/signin">
                Sign in
              </Link>
            </>
          ) : (
            <>
              <div className="account-section" data-testid="account-plan">
                <h2 className="section-title">Plan</h2>
                {syncing && entitlement?.tier !== "premium" ? (
                  <div data-testid="entitlement-syncing" aria-live="polite">
                    <p className="page-copy">
                      <strong>Payment received</strong> — your access is
                      syncing. This usually takes a few seconds, and this page
                      updates on its own. No need to pay again.
                    </p>
                  </div>
                ) : syncTimedOut && entitlement?.tier !== "premium" ? (
                  <div data-testid="entitlement-sync-timeout" aria-live="polite">
                    <p className="page-copy">
                      <strong>Payment received</strong> — this is taking longer
                      than usual to sync. Your access is safe; no need to pay
                      again. Refresh this page in a moment, and if it still
                      doesn&apos;t show, contact support.
                    </p>
                    <button
                      type="button"
                      className="recheck-button"
                      onClick={() => window.location.reload()}
                    >
                      Refresh
                    </button>
                  </div>
                ) : entitlement?.tier === "premium" ? (
                  <>
                    <p className="page-copy">
                      <strong>Premium</strong> — unlimited checks, full
                      history, progress, and the daily reminder.
                    </p>
                    {entitlement.currentPeriodEnd && !canceled ? (
                      <p className="field-hint" data-testid="renewal-date">
                        {entitlement.cancelAtPeriodEnd
                          ? `Access until ${new Date(
                              entitlement.currentPeriodEnd
                            ).toLocaleDateString()} — will not renew`
                          : entitlement.status === "trialing"
                            ? `Trial ends ${new Date(
                                entitlement.currentPeriodEnd
                              ).toLocaleDateString()}`
                            : `Renews ${new Date(
                                entitlement.currentPeriodEnd
                              ).toLocaleDateString()}`}
                      </p>
                    ) : null}
                    {entitlement.source === "play" ? (
                      <a
                        className="recheck-button link-button"
                        href="https://play.google.com/store/account/subscriptions"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Manage or cancel in Google Play
                      </a>
                    ) : (
                      <>
                        {canceled || entitlement.cancelAtPeriodEnd ? null : (
                          <button
                            type="button"
                            className="recheck-button"
                            disabled={canceling}
                            data-testid="cancel-subscription"
                            onClick={cancelSubscription}
                          >
                            {canceling
                              ? "Canceling…"
                              : "Cancel — one tap, effective at period end"}
                          </button>
                        )}
                        <p className="field-hint" aria-live="polite">
                          {canceled
                            ? `Canceled. Access until ${new Date(
                                canceled.accessUntil
                              ).toLocaleDateString()}. No charge coming.`
                            : ""}
                        </p>
                        <button
                          type="button"
                          className="recheck-button"
                          onClick={manageStripe}
                        >
                          Manage card &amp; billing
                        </button>
                      </>
                    )}
                  </>
                ) : mode === "trial" ? (
                  <>
                    <p className="page-copy">
                      <strong>Free taste</strong> — your first day of checks.
                      After that, your free week takes over: 7 days of
                      everything, and we email you before any charge.
                    </p>
                    <Link className="recheck-button link-button" href="/subscribe">
                      Start your free week
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="page-copy">
                      <strong>Free</strong> — {entitlement?.checksToday ?? 0} of{" "}
                      {entitlement?.freeDailyLimit ?? 5} checks used today.
                    </p>
                    <Link className="recheck-button link-button" href="/subscribe">
                      See what Premium includes
                    </Link>
                  </>
                )}
              </div>

              {nudge ? (
                <div className="account-section" data-testid="nudge-settings">
                  <h2 className="section-title">Daily reminder</h2>
                  <p className="page-copy">
                    {nudge.optIn
                      ? "One gentle reminder a day, at the hour you pick."
                      : "The reminder is off. Turn it on from the home page after your next check-in."}
                  </p>
                  {nudge.optIn ? (
                    <div className="field-stack">
                      <label htmlFor="nudge-hour" className="field-label">
                        Remind me around
                      </label>
                      <select
                        id="nudge-hour"
                        className="text-input"
                        value={nudge.hour}
                        onChange={(event) => {
                          const hour = Number(event.target.value);
                          void saveNudge(
                            nudge,
                            { ...nudge, hour },
                            { nudgeHour: hour }
                          );
                        }}
                      >
                        {Array.from({ length: 17 }, (_, i) => i + 5).map(
                          (hour) => (
                            <option key={hour} value={hour}>
                              {hour === 12
                                ? "12:00 pm"
                                : hour < 12
                                  ? `${hour}:00 am`
                                  : `${hour - 12}:00 pm`}
                            </option>
                          )
                        )}
                      </select>

                      <label htmlFor="nudge-cadence" className="field-label">
                        How often
                      </label>
                      <select
                        id="nudge-cadence"
                        className="text-input"
                        value={nudge.cadence}
                        onChange={(event) => {
                          const cadence = event.target
                            .value as NudgeSettings["cadence"];
                          void saveNudge(
                            nudge,
                            { ...nudge, cadence },
                            { nudgeCadence: cadence }
                          );
                        }}
                      >
                        <option value="daily">Once a day</option>
                        <option value="few_per_week">A few times a week</option>
                        <option value="weekly">Once a week</option>
                      </select>

                      <label htmlFor="nudge-quiet" className="field-label">
                        Quiet hours (no reminders)
                      </label>
                      <div className="field-row" id="nudge-quiet">
                        <select
                          aria-label="Quiet hours start"
                          className="text-input"
                          value={nudge.quietStart ?? ""}
                          onChange={(event) => {
                            const raw = event.target.value;
                            const quietStart = raw === "" ? null : Number(raw);
                            // Clearing the start clears the whole window.
                            const quietEnd =
                              quietStart === null ? null : nudge.quietEnd;
                            void saveNudge(
                              nudge,
                              { ...nudge, quietStart, quietEnd },
                              {
                                nudgeQuietStart: quietStart,
                                nudgeQuietEnd: quietEnd
                              }
                            );
                          }}
                        >
                          <option value="">Off</option>
                          {Array.from({ length: 24 }, (_, hour) => (
                            <option key={hour} value={hour}>
                              {formatHour(hour)}
                            </option>
                          ))}
                        </select>
                        <span className="field-hint">to</span>
                        <select
                          aria-label="Quiet hours end"
                          className="text-input"
                          value={nudge.quietEnd ?? ""}
                          disabled={nudge.quietStart === null}
                          onChange={(event) => {
                            const raw = event.target.value;
                            const quietEnd = raw === "" ? null : Number(raw);
                            void saveNudge(
                              nudge,
                              { ...nudge, quietEnd },
                              { nudgeQuietEnd: quietEnd }
                            );
                          }}
                        >
                          <option value="">—</option>
                          {Array.from({ length: 24 }, (_, hour) => (
                            <option key={hour} value={hour}>
                              {formatHour(hour)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {nudgeError ? (
                        <p
                          className="field-error"
                          data-testid="nudge-save-error"
                          role="alert"
                        >
                          Couldn&apos;t save — try again.
                        </p>
                      ) : nudgeSaved ? (
                        <p className="field-hint">Saved.</p>
                      ) : null}

                      <button
                        type="button"
                        className="recheck-button"
                        data-testid="nudge-turn-off"
                        onClick={turnOffNudges}
                      >
                        Turn off reminders
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="account-section" data-testid="support-section">
                <h2 className="section-title">Help &amp; refunds</h2>
                <p className="page-copy">
                  Stuck, confused, or need money back? Send a message from
                  here — it opens a case tied to your account.
                </p>
                <SupportCaseForm />
              </div>

              <div className="account-section">
                <h2 className="section-title">Stored health data</h2>
                <p className="page-copy">
                  <a href="/api/account/export" data-testid="account-export-link">
                    Download your data
                  </a>{" "}
                  — everything we hold, as one file, including your checks and
                  saved meals. Anything not in the file is named inside it,
                  with the reason.
                </p>
                <p className="page-copy">
                  Withdraw your storage consent and erase your saved A1C,
                  meal history, progress, reminders, and claimed Pantry Review
                  data. Your login and subscription remain available, and you
                  can continue using guest mode without saved history.
                </p>
                {confirmHealthWithdrawal ? (
                  <div className="delete-confirm">
                    <p className="field-error">
                      Erase all saved health data and withdraw storage consent?
                    </p>
                    <button
                      type="button"
                      className="danger-button"
                      disabled={withdrawingHealthConsent}
                      data-testid="confirm-health-data-delete"
                      onClick={withdrawHealthDataConsent}
                    >
                      {withdrawingHealthConsent
                        ? "Erasing…"
                        : "Yes, erase saved health data"}
                    </button>
                    <button
                      type="button"
                      className="recheck-button"
                      disabled={withdrawingHealthConsent}
                      onClick={() => setConfirmHealthWithdrawal(false)}
                    >
                      Keep saved health data
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="recheck-button"
                    data-testid="withdraw-health-data-consent"
                    onClick={() => setConfirmHealthWithdrawal(true)}
                  >
                    Withdraw consent &amp; erase saved health data
                  </button>
                )}
              </div>

              <div className="account-section" data-testid="analytics-opt-out">
                <h2 className="section-title">Usage analytics</h2>
                <p className="page-copy">
                  We count anonymous product events (never meal text, photos,
                  or lab values) to see what&apos;s working. You can turn this
                  off for this browser.
                </p>
                <label className="field-label">
                  <input
                    type="checkbox"
                    checked={analyticsDisabled}
                    onChange={(event) => {
                      const off = event.target.checked;
                      setAnalyticsPreference(off);
                      // Umami's built-in kill switch: any truthy value stops
                      // the tracker in this browser (PR-6 opt-out gate).
                      if (off) {
                        window.localStorage.setItem("umami.disabled", "1");
                      } else {
                        window.localStorage.removeItem("umami.disabled");
                      }
                    }}
                  />{" "}
                  Don&apos;t count my usage in analytics
                </label>
              </div>

              <div className="account-section">
                <h2 className="section-title">Session</h2>
                <button
                  type="button"
                  className="recheck-button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                >
                  Sign out
                </button>
              </div>

              <div className="account-section" data-testid="account-delete">
                <h2 className="section-title">Delete account &amp; data</h2>
                <p className="page-copy">
                  Deletes your profile, A1C, meal history, reminders, and
                  subscription records — permanently. An active Stripe
                  subscription is cancelled for you; a Google Play
                  subscription must be cancelled in Google Play first, or
                  deletion is refused so you&apos;re never left paying
                  unseen. See{" "}
                  <a className="inline-link" href="/account/delete">
                    what deletion removes and what remains
                  </a>
                  .
                </p>
                {confirmDelete ? (
                  <div className="delete-confirm">
                    <p className="field-error">
                      This can&apos;t be undone. Delete everything?
                    </p>
                    <button
                      type="button"
                      className="danger-button"
                      disabled={deleting}
                      data-testid="confirm-delete"
                      onClick={deleteAccount}
                    >
                      {deleting ? "Deleting…" : "Yes, delete everything"}
                    </button>
                    <button
                      type="button"
                      className="recheck-button"
                      disabled={deleting}
                      onClick={() => setConfirmDelete(false)}
                    >
                      Keep my account
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="recheck-button"
                    data-testid="delete-account"
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete account &amp; data
                  </button>
                )}
              </div>

              {error ? <p className="field-error">{error}</p> : null}
            </>
          )}
        </section>

        <footer className="page-footer">
          <Link href="/">Home</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </footer>
    </div>
  );
}
