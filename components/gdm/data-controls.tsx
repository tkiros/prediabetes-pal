"use client";

import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

import { clearGdmDeviceKeys, gdmFetch } from "../../lib/client/gdm-api";
import { GDM_COPY } from "../../lib/pal/gdm/copy";
import { GDM_ROUTES } from "../../lib/pal/gdm/routes";

const COPY = GDM_COPY["gdm-data-controls"];
const STATUS = GDM_COPY["gdm-status"];
const SAVE_FAILED = GDM_COPY["gdm-save-failed"].line;

type Destructive = "erase" | "delete";

/**
 * R41: the failure line for an erase or a deletion that did not complete. The
 * shared delete route answers 409 while a Google Play subscription is active
 * (app/api/account/delete/route.ts), and "try again in a moment" could never
 * fix that, so that one refusal says why. Every other failure keeps the
 * generic line. (A 401 never gets here: gdmFetch sends it to sign-in.)
 */
export function dataControlsFailure(action: Destructive, status: number): string {
  if (action === "delete" && status === 409) return COPY.deleteBlocked;
  return SAVE_FAILED;
}

/**
 * Your data (G-77), in this order and weight: Download my data · Sign out ·
 * then, set apart and never in the filled accent, Erase my health data and
 * Delete my account, each behind a second press. The shared account routes do
 * the work; this door adds no server code for them. Every path that ends her
 * session or her data also clears the door's `pal.gdm.*` device keys.
 */
export function GdmDataControls() {
  const [confirming, setConfirming] = useState<Destructive | null>(null);
  const [busy, setBusy] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const eraseRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const lastConfirming = useRef<Destructive | null>(null);

  // G-39: the second press is where focus goes; on Cancel it returns to the
  // control that opened it.
  useEffect(() => {
    const previous = lastConfirming.current;
    lastConfirming.current = confirming;
    if (confirming) confirmRef.current?.focus();
    else if (previous === "erase") eraseRef.current?.focus();
    else if (previous === "delete") deleteRef.current?.focus();
  }, [confirming]);

  async function run(action: Destructive) {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    const result =
      action === "erase"
        ? await gdmFetch("/api/account/health-data", { method: "DELETE" })
        : await gdmFetch("/api/account/delete", { method: "POST" });
    if (!result.ok) {
      setBusy(false);
      setFailure(dataControlsFailure(action, result.status));
      return;
    }
    clearGdmDeviceKeys();
    setRemoved(true);
    window.location.assign(GDM_ROUTES.landing); // stays disabled until it leaves
  }

  async function leave() {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    // Her unsent draft goes before the session does.
    clearGdmDeviceKeys();
    try {
      await signOut({ callbackUrl: GDM_ROUTES.landing });
    } catch {
      setBusy(false);
      setFailure(SAVE_FAILED);
    }
  }

  const confirmBlock = (action: Destructive, go: string) => (
    <div className="delete-confirm">
      <p id={`gdm-${action}-warn`}>{COPY.eraseWarn}</p>
      <div className="gdm-actions">
        <button
          type="button"
          className="danger-button"
          ref={confirmRef}
          disabled={busy}
          aria-describedby={`gdm-${action}-warn`}
          onClick={() => void run(action)}
        >
          {go}
        </button>
        <button type="button" className="secondary-button" disabled={busy} onClick={() => setConfirming(null)}>
          {COPY.cancel}
        </button>
      </div>
    </div>
  );

  return (
    <section className="surface-card legal-card gdm-data">
      <div className="gdm-actions">
        <a className="secondary-button link-button" href="/api/account/export" download>
          {COPY.download}
        </a>
        <button type="button" className="secondary-button" disabled={busy} onClick={() => void leave()}>
          {COPY.signOut}
        </button>
      </div>

      <div className="gdm-danger-zone">
        {confirming === "erase" ? (
          confirmBlock("erase", COPY.eraseGo)
        ) : (
          <button
            type="button"
            className="secondary-button"
            ref={eraseRef}
            disabled={busy}
            onClick={() => setConfirming("erase")}
          >
            {COPY.erase}
          </button>
        )}
        {/* The row has no separate warn/confirm pair for deleting the account:
            it reuses eraseWarn, which is true of a deletion too, and names the
            action again on the confirm control. */}
        {confirming === "delete" ? (
          confirmBlock("delete", COPY.deleteAccount)
        ) : (
          <button
            type="button"
            className="secondary-button"
            ref={deleteRef}
            disabled={busy}
            onClick={() => setConfirming("delete")}
          >
            {COPY.deleteAccount}
          </button>
        )}
      </div>

      {failure ? (
        <p className="field-error" role="alert">
          {failure}
        </p>
      ) : null}
      <p className="field-hint gdm-status" aria-live="polite">
        {removed ? STATUS.removed : null}
      </p>
    </section>
  );
}
