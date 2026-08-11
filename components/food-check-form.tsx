"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { track } from "../lib/client/analytics";
import { submitCheck } from "../lib/client/check";
import {
  clarifyElapsedBucket,
  clarifyReasonForQuestion,
  type ClarifyReason
} from "../lib/pal/clarify";
import { historyStore } from "../lib/client/history-store";
import { profileStore } from "../lib/client/profile-store";
import { useHydrated } from "../lib/client/use-hydrated";
import { tasterStore } from "../lib/client/taster-store";
import { routeA1C } from "../lib/pal/a1c";
import {
  type CheckUiState,
  isSlowThresholdReached,
  mapCheckFailure
} from "../lib/client/ui-state";
import {
  type CheckFormInput,
  validateCheckForm
} from "../lib/client/validation";
import type { MealDraftItem } from "../lib/meal/photo-extract";
import { photoInputEnabled } from "../lib/photo-input-flag";
import type { PhotoDraftResult } from "../lib/client/photo-draft";
import { IconKeyboard } from "./icons";
import { MealMemoryRecall } from "./meal-memory-recall";
import { PhotoDraftReview } from "./photo-draft-review";
import { PhotoInputButton } from "./photo-input-button";
import { RequestStatus } from "./request-status";
import { PantryEntry, ResultCard, showPantryEntry } from "./result-card";
import { VoiceInputButton } from "./voice-input-button";

type FieldErrors = Partial<Record<"food" | "a1c", string>>;

// Paywall mode mirrors GET /api/paywall + lib/server/pricing.paywallMode().
export type PaywallMode = "legacy" | "trial";
// tasterStore.status() return union (device-local Day-1 allowance state).
export type TasterStatus = "available" | "exhausted" | "expired";

// Pure decision helpers, colocated on the module so they can be unit-tested
// without a jsdom/component harness (this repo has none — Tasks 4.1/4.2).
//
// Gate: only trial mode walls, only once the anonymous taster has spent or
// aged out their free checks, and NEVER for an entitled session (AUD-009: the
// server says this user is Premium/trialing — the device meter must not send
// them to /subscribe). Legacy mode never gates (fail-open by shape).
export function shouldGateSubmit(
  mode: PaywallMode,
  status: TasterStatus,
  entitled = false
): boolean {
  return !entitled && mode === "trial" && status !== "available";
}

// Record: only trial mode meters, and only for anonymous tasters — an entitled
// session's results are unlimited server-side and must never be metered as
// anonymous (AUD-009). Callers pass `!entitled` as the anonymous signal.
export function shouldRecordTaster(mode: PaywallMode, hasStoreOrAnon: boolean): boolean {
  return mode === "trial" && hasStoreOrAnon;
}

export function FoodCheckForm() {
  const [input, setInput] = useState<CheckFormInput>({ food: "", a1c: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [uiState, setUiState] = useState<CheckUiState>({ kind: "idle" });
  const isHydrated = useHydrated();
  const [inputMethod, setInputMethod] = useState<"text" | "voice" | "photo">("text");
  const [photoDraft, setPhotoDraft] = useState<{
    dish: string | null;
    items: MealDraftItem[];
  } | null>(null);
  const [photoNotice, setPhotoNotice] = useState<string | null>(null);
  const [lastCheckId, setLastCheckId] = useState<string | null>(null);
  // Snapshot of the submitted meal + method for the result's Meal row —
  // read at success time so edits to the field don't rewrite the echo.
  const [lastMeal, setLastMeal] = useState<{
    food: string;
    method: "text" | "voice" | "photo";
  } | null>(null);
  const [actionDone, setActionDone] = useState(false);
  const [mode, setMode] = useState<PaywallMode>("legacy");
  // AUD-009: server-resolved entitlement. Defaults false (guest posture); an
  // entitled session skips the device taster gate/meter entirely.
  const [entitled, setEntitled] = useState(false);
  const foodInputRef = useRef<HTMLTextAreaElement | null>(null);
  const initialPrefillRef = useRef<{
    profile: ReturnType<typeof profileStore.get>;
    recheck: string | null;
  } | null>(null);
  // One-clarification cap + clarify metrics (P1.3 §8/§10.1). Holds the reason
  // and start time of an OUTSTANDING deterministic clarify — set when a clarify
  // card renders, cleared when the next submission answers it. A ref, not
  // state: it must not trigger a re-render, and it is read/written inside the
  // submit handler only.
  const pendingClarifyRef = useRef<{
    reason: ClarifyReason;
    startedAt: number;
  } | null>(null);

  useEffect(() => {
    // Day-1 taster: learn the paywall mode once on mount. Fail-open to the
    // "legacy" default on ANY failure (network, non-2xx, bad JSON) — a broken
    // paywall lookup must never wall a user, only ever fall back to legacy.
    let cancelled = false;
    fetch("/api/paywall")
      .then((res) => res.json())
      .then((data: { mode?: unknown; entitled?: unknown }) => {
        if (!cancelled && (data?.mode === "trial" || data?.mode === "legacy")) {
          setMode(data.mode);
        }
        if (!cancelled && data?.entitled === true) {
          setEntitled(true);
        }
      })
      .catch(() => {
        // fail-open: keep the "legacy" default set above.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Daily-loop conveniences (P3): remember the onboarding A1C, and honor a
    // one-tap re-check handoff from the history page. Storage reads stay
    // outside the setState updater — updaters must be pure (StrictMode
    // double-invokes them).
    if (initialPrefillRef.current === null) {
      const profile = profileStore.get();
      let recheck: string | null = null;
      try {
        recheck = window.sessionStorage.getItem("pal.recheck");
        if (recheck) {
          window.sessionStorage.removeItem("pal.recheck");
        }
      } catch {
        // best-effort prefill only
      }
      initialPrefillRef.current = { profile, recheck };
    }

    const { profile, recheck } = initialPrefillRef.current;
    const update = window.setTimeout(() => {
      setInput((current) => ({
        food: current.food === "" && recheck ? recheck : current.food,
        a1c:
          current.a1c === "" && profile ? profile.a1c.toFixed(1) : current.a1c,
      }));
    }, 0);

    return () => window.clearTimeout(update);
  }, []);

  const isSubmitting =
    uiState.kind === "submitting" || uiState.kind === "slow";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    // Day-1 taster gate (trial mode only): an anonymous user who has spent or
    // aged out their free checks goes to the wall — no /api/check spend here.
    // An entitled session is never gated (AUD-009).
    if (shouldGateSubmit(mode, tasterStore.status(), entitled)) {
      window.location.assign("/subscribe");
      return;
    }

    const result = validateCheckForm(input);

    if (!result.ok) {
      setErrors(
        result.issues.reduce<FieldErrors>((nextErrors, issue) => {
          nextErrors[issue.field] = issue.message;
          return nextErrors;
        }, {})
      );
      setUiState({
        kind: "invalid",
        message: "Fix the highlighted fields before submitting."
      });
      return;
    }

    setErrors({});

    // Offline? Short-circuit to the network copy instead of a hanging fetch.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setUiState({ kind: "error", message: mapCheckFailure({ code: "network" }) });
      return;
    }

    setUiState({ kind: "submitting" });

    const startedAt = Date.now();
    const slowTimer = window.setTimeout(() => {
      setUiState((currentState) => {
        if (
          currentState.kind !== "submitting" ||
          !isSlowThresholdReached(startedAt)
        ) {
          return currentState;
        }

        return { kind: "slow" };
      });
    }, 5_000);

    // One-clarification cap (§8): if this submission answers an outstanding
    // clarify, mark it so the server suppresses a second ambiguity question.
    // Read the pending clarify here, but DO NOT clear the ref or record the
    // resolution yet — that only happens once submitCheck actually resolves
    // (below). A thrown submit must leave the ref intact so the retry still
    // carries clarified:true and re-records resolution on success (U3).
    const pendingClarify = pendingClarifyRef.current;

    try {
      // One id shared by the on-device copy and the server row (4B) so the
      // sign-in migration dedupes instead of duplicating.
      const clientId = crypto.randomUUID();
      const response = await submitCheck(result.data, {
        clientId,
        inputMethod,
        clarified: pendingClarify !== null,
        // §P3.1: the bounded reason of the clarify being answered, so the server
        // can persist which approved question was asked. Bounded enum, not text.
        clarifyCategory: pendingClarify?.reason
      });

      // The submit resolved — the outstanding clarify is now genuinely answered.
      // Clear the pending ref and record the resolution (§10.1) — reason +
      // elapsed bucket only, never the meal text. Done here (not before the
      // await) so a thrown submit leaves the ref intact for the retry (U3).
      if (pendingClarify) {
        pendingClarifyRef.current = null;
        track({
          name: "clarification_resolved",
          props: {
            category: pendingClarify.reason,
            elapsed: clarifyElapsedBucket(Date.now() - pendingClarify.startedAt)
          }
        });
      }

      // §10.1: a deterministic clarify card renders — record which of the three
      // bounded reasons fired so clarify/resolution/abandonment rates are
      // computable. A model-authored or generic clarify maps to no reason and
      // is not metered. Abandonment = requested with no later resolved.
      if (response.kind === "clarify") {
        const reason = clarifyReasonForQuestion(response.question);
        if (reason) {
          pendingClarifyRef.current = { reason, startedAt: Date.now() };
          track({
            name: "clarification_requested",
            props: { category: reason }
          });
        }
      }

      // W-10: which clinical class fired. The route id only — never the input
      // that matched it, which would be health data.
      if (response.kind === "clinical") {
        track({ name: "clinical_route", props: { route: response.route } });
      }

      // Meal memory (P3): persist successful verdicts on-device. Non-result
      // kinds (clarify/not_food/out_of_scope/clinical/retry) are moments, not
      // meals.
      if (response.kind === "result") {
        // W-10/N-12: the activation funnel needs a first-check marker or the
        // north-star metric is not computable end-to-end. Read BEFORE the add()
        // below, which is what makes this check the first one.
        const firstCheck = historyStore.all().length === 0;

        historyStore.add({
          clientId,
          food: result.data.food,
          risk: response.risk,
          a1cBand: routeA1C(result.data.a1c).band,
          inputMethod,
          createdAt: new Date().toISOString()
        });
        setLastCheckId(clientId);
        setLastMeal({ food: result.data.food, method: inputMethod });
        setActionDone(false);
        track({
          name: "check_completed",
          props: {
            risk: response.risk,
            kind: response.kind,
            input_method: inputMethod,
            first_check: firstCheck
          }
        });

        // Day-1 taster meter (trial mode): count this check against the free
        // allowance BEFORE the result renders, so a reload can't double-spend.
        // AUD-009: an entitled session's checks are unlimited server-side and
        // are never metered as anonymous — otherwise ten Premium checks would
        // exhaust the device store and the gate above would wall check #11.
        const anonymousTaster = !entitled;
        if (shouldRecordTaster(mode, anonymousTaster)) {
          const used = tasterStore.recordCheck();
          track({ name: "taster_check", props: { used } });
        }
      }

      setUiState({ kind: "done", response });
    } catch (error) {
      setUiState({ kind: "error", message: mapCheckFailure(error) });
    } finally {
      window.clearTimeout(slowTimer);
    }
  }

  function handleChange(field: keyof CheckFormInput, value: string) {
    setInput((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setPhotoNotice(null);

    if (uiState.kind === "invalid" || uiState.kind === "error") {
      setUiState({ kind: "idle" });
    }
  }

  function handleVoiceTranscript(transcript: string) {
    // The transcript lands in the same textarea; the user reviews, edits, and
    // submits their own words — the identical text path and engine (§6.2).
    handleChange("food", transcript);
    setInputMethod("voice");
  }

  function handleTypedFoodChange(value: string) {
    handleChange("food", value);
    // ponytail: an emptied field restarts as typed input; small edits after a
    // dictation/photo confirm keep counting as voice/photo — good enough for
    // the method signal.
    if (value.trim().length === 0) {
      setInputMethod("text");
    }
  }

  function handlePhotoDraft(result: PhotoDraftResult) {
    if (result.kind === "draft") {
      setPhotoDraft({ dish: result.dish, items: result.items });
      track({
        name: "photo_draft",
        props: {
          items: result.items.length,
          uncertain: result.items.filter((item) => item.uncertain).length
        }
      });
    } else if (result.kind === "upsell") {
      window.location.assign("/subscribe");
    } else {
      setPhotoNotice(result.message);
    }
  }

  if (!isHydrated) {
    return (
      <section aria-live="polite" className="placeholder-card">
        <p className="placeholder-title">One moment</p>
        <p className="placeholder-copy">Your meal check is loading.</p>
      </section>
    );
  }

  // Visible Day-1 meter (trial mode): the wall is never a surprise. Hidden for
  // entitled sessions — "N free checks left" is false for unlimited Premium.
  const tasterRemaining =
    mode === "trial" && !entitled ? tasterStore.remaining() : null;

  return (
    <form
      onSubmit={handleSubmit}
      className="form-grid"
      data-input-method={inputMethod}
      noValidate
    >
      <div className="field-stack">
        <label htmlFor="food" className="field-label">
          What are you thinking about eating?
        </label>
        {/* The three first-class input methods, visible BEFORE the user
            commits to typing: type, speak, or snap a photo. All three land in
            the same reviewed text path — voice and photo never bypass it. */}
        <div
          className="chip-row"
          role="group"
          aria-label="Three ways to add your meal"
          data-testid="input-method-row"
        >
          <button
            type="button"
            className="selectable-chip method-chip"
            aria-pressed={inputMethod === "text"}
            data-testid="type-input-button"
            onClick={() => foodInputRef.current?.focus()}
          >
            <IconKeyboard size={20} />
            Type it
          </button>
          <VoiceInputButton
            onTranscript={handleVoiceTranscript}
            disabled={isSubmitting}
            onDictateFallback={() => foodInputRef.current?.focus()}
          />
          {photoInputEnabled() ? (
            <PhotoInputButton
              onDraft={handlePhotoDraft}
              onRequestOpen={() => {
                // Same taster gate as handleSubmit: a walled taster never spends
                // a draft call — the picker never opens. Entitled sessions pass.
                if (shouldGateSubmit(mode, tasterStore.status(), entitled)) {
                  window.location.assign("/subscribe");
                  return false;
                }
                return true;
              }}
              disabled={isSubmitting}
            />
          ) : null}
        </div>
        <textarea
          id="food"
          name="food"
          rows={3}
          ref={foodInputRef}
          value={input.food}
          onChange={(event) => {
            handleTypedFoodChange(event.target.value);
          }}
          enterKeyHint="go"
          placeholder="Example: grilled chicken with rice and salad"
          aria-describedby={errors.food ? "food-error" : undefined}
          aria-invalid={errors.food ? true : undefined}
          className="text-input"
        />
        {errors.food ? (
          <p id="food-error" className="field-error">
            {errors.food}
          </p>
        ) : null}
        {photoNotice ? <p className="field-hint">{photoNotice}</p> : null}
        {photoDraft ? (
          <PhotoDraftReview
            dish={photoDraft.dish}
            items={photoDraft.items}
            onConfirm={(text) => {
              handleChange("food", text);
              setInputMethod("photo");
              setPhotoDraft(null);
            }}
            onDiscard={() => setPhotoDraft(null)}
          />
        ) : null}
      </div>

      <div className="field-stack">
        <label htmlFor="a1c" className="field-label">
          Latest A1C
        </label>
        <input
          id="a1c"
          name="a1c"
          type="number"
          inputMode="decimal"
          step="0.1"
          value={input.a1c}
          onChange={(event) => {
            handleChange("a1c", event.target.value);
          }}
          enterKeyHint="go"
          placeholder="6.1"
          aria-describedby={errors.a1c ? "a1c-error" : "a1c-help"}
          aria-invalid={errors.a1c ? true : undefined}
          className="text-input"
        />
        <p id="a1c-help" className="field-hint">
          Enter one decimal place, like 6.1.
        </p>
        {errors.a1c ? (
          <p id="a1c-error" className="field-error">
            {errors.a1c}
          </p>
        ) : null}
      </div>

      <button type="submit" disabled={isSubmitting} className="primary-button">
        {isSubmitting ? "Checking..." : "Check this meal"}
      </button>

      {tasterRemaining !== null && tasterRemaining > 0 ? (
        <p className="taster-counter" data-testid="taster-counter">
          {tasterRemaining === 1
            ? "1 free check left today"
            : `${tasterRemaining} free checks left today`}
        </p>
      ) : null}

      {uiState.kind === "submitting" ||
      uiState.kind === "slow" ||
      uiState.kind === "error" ? (
        <RequestStatus state={uiState} />
      ) : uiState.kind === "done" ? (
        <>
          <ResultCard
            response={uiState.response}
            food={lastMeal?.food}
            inputMethod={lastMeal?.method}
            actionDone={actionDone}
            onActionDone={
              lastCheckId
                ? () => {
                    historyStore.markActionDone(lastCheckId);
                    setActionDone(true);
                    // Signed-in: mirror the ack server-side (guests get 401 —
                    // fire-and-forget either way).
                    void fetch("/api/history/action", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ clientId: lastCheckId })
                    }).catch(() => undefined);
                  }
                : undefined
            }
          />
          {showPantryEntry(
            uiState.response.kind,
            uiState.response.kind === "result" ? uiState.response.risk : undefined
          ) ? (
            <PantryEntry />
          ) : null}
          {/* §P3.3 recall panel: render-after-result only, and only for a
              completed meal card. Self-gates on the build flag + the server's
              answer (guest/free/flag-off get no matches), so it never shows as a
              paywall or an error. Reads memory; never feeds the engine above. */}
          {uiState.response.kind === "result" ? (
            <MealMemoryRecall food={lastMeal?.food} />
          ) : null}
        </>
      ) : (
        <section aria-live="polite" className="placeholder-card">
          <p className="placeholder-copy">
            {uiState.kind === "invalid"
              ? uiState.message
              : "Your answer will show up right here."}
          </p>
        </section>
      )}
    </form>
  );
}
