"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import { gdmFetch } from "../../lib/client/gdm-api";
import { useFocusAfterRender } from "../../lib/client/gdm-focus";
import { preparePhoto } from "../../lib/client/gdm-photo";
import { GDM_COPY } from "../../lib/pal/gdm/copy";
import { PLAN_PHOTO_CAP, PLAN_PHOTO_PATH, planPhotoPath } from "../../lib/pal/gdm/plan-photo";

const CONTROLS = GDM_COPY["gdm-plan-controls"];
const STATUS = GDM_COPY["gdm-status"];
const LOAD_FAILED = GDM_COPY["gdm-load-failed"];
const CANCEL = GDM_COPY["gdm-data-controls"].cancel;
const SAVE_FAILED = GDM_COPY["gdm-save-failed"].line;

export const PHOTO_ADD_ID = "gdm-plan-photo-add";
export const photoRemoveId = (id: string) => `gdm-plan-photo-${id}-remove`;
export const photoCancelId = (id: string) => `gdm-plan-photo-${id}-cancel`;

/** Where one of her photos is shown from: the photo route, to her only, never cached. */
export const planPhotoSrc = planPhotoPath;

/** G-20: the add control is offered only below the cap, so the route's refusal is never reached from the page. */
export const canAddPhoto = (held: number) => held < PLAN_PHOTO_CAP;

type LoadState = "loading" | "failed" | "ready";

/** Her photo ids, oldest first, from the photo route's list (ids only; never the bytes). */
function usePlanPhotoIds(): {
  ids: string[];
  setIds: Dispatch<SetStateAction<string[]>>;
  state: LoadState;
  retry: () => void;
} {
  const [ids, setIds] = useState<string[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [attempt, setAttempt] = useState(0); // a retry after a failed load is the next attempt

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await gdmFetch<{ items: Array<{ id: string }> }>(PLAN_PHOTO_PATH);
      if (cancelled) return;
      if (result.ok) setIds(result.data.items.map((item) => item.id));
      setState(result.ok ? "ready" : "failed");
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState("loading");
    setAttempt((count) => count + 1);
  }, []);
  return { ids, setIds, state, retry };
}

function PhotosLoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="surface-card legal-card gdm-plan-photos">
      <p role="alert">{LOAD_FAILED.line}</p>
      <button type="button" className="secondary-button gdm-retry" onClick={onRetry}>
        {LOAD_FAILED.retry}
      </button>
    </div>
  );
}

export type PlanPhotoListProps = {
  ids: readonly string[];
  /** A photo is on its way: it shows as a Saving row of its own. */
  adding: boolean;
  /** The photo whose Remove was pressed once (G-76), if any. */
  confirming: string | null;
  /** An add or a remove is in flight: every control waits. */
  busy: boolean;
  onAdd: () => void;
  onAskRemove: (id: string) => void;
  onRemove: (id: string) => void;
  onCancel: (id: string) => void;
};

/**
 * Her photos and their controls, drawn from props alone. Each photo is a lazy
 * thumbnail (G-20: every view decrypts it again), named `photoAlt` (R54), with
 * Remove photo, which takes two presses (G-76). Below them, the add control,
 * only while she keeps fewer than the cap (G-20). With no photo, the add
 * control is all there is.
 */
export function PlanPhotoList({ ids, adding, confirming, busy, onAdd, onAskRemove, onRemove, onCancel }: PlanPhotoListProps) {
  return (
    <div className="gdm-plan-photos">
      {ids.length > 0 || adding ? (
        <ul className="gdm-plan-photo-list" role="list">
          {ids.map((id) => (
            <li key={id} className="surface-card gdm-plan-photo">
              {/* A plain <img>: next/image would fetch her private, no-store photo without her session and cache it. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="gdm-plan-photo-img" src={planPhotoSrc(id)} alt={CONTROLS.photoAlt} loading="lazy" />
              <div className="gdm-actions">
                {confirming === id ? (
                  <>
                    <button
                      id={photoRemoveId(id)}
                      type="button"
                      className="danger-button"
                      disabled={busy}
                      onClick={() => onRemove(id)}
                    >
                      {CONTROLS.photoRemove}
                    </button>
                    <button
                      id={photoCancelId(id)}
                      type="button"
                      className="secondary-button"
                      disabled={busy}
                      onClick={() => onCancel(id)}
                    >
                      {CANCEL}
                    </button>
                  </>
                ) : (
                  <button
                    id={photoRemoveId(id)}
                    type="button"
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => onAskRemove(id)}
                  >
                    {CONTROLS.photoRemove}
                  </button>
                )}
              </div>
            </li>
          ))}
          {adding ? <li className="surface-card gdm-plan-photo gdm-plan-photo-saving">{STATUS.saving}</li> : null}
        </ul>
      ) : null}
      {canAddPhoto(ids.length) ? (
        <button id={PHOTO_ADD_ID} type="button" className="secondary-button gdm-plan-photo-add" disabled={busy} onClick={onAdd}>
          {CONTROLS.photoAdd}
        </button>
      ) : null}
    </div>
  );
}

/** The new photo's id, or null when the device could not open the file, it would not fit, or the save failed. */
async function upload(file: File): Promise<string | null> {
  let photo;
  try {
    photo = await preparePhoto(file);
  } catch {
    return null;
  }
  const result = await gdmFetch<{ id: string }>(PLAN_PHOTO_PATH, { method: "POST", body: photo });
  return result.ok ? result.data.id : null;
}

/**
 * A photo of her sheet on My plan (Task 3.3), kept as a photo: the device
 * makes it smaller and sends it; the route encrypts and keeps it; nothing
 * reads it. The add control opens the device's own chooser through a hidden
 * file input: a photo she already has, or the camera. R56: no `capture`
 * attribute, which on iOS Safari and Android Chrome skips the chooser and
 * opens only the camera. A file the device cannot open (a HEIC on some browsers), or any
 * failed save, shows the save-failed line and clears the input (G-20). Status
 * goes through the page's one polite live region (G-36), via `onStatus`.
 */
export function PlanPhotos({ onStatus }: { onStatus: (line: string | null) => void }) {
  const { ids, setIds, state, retry } = usePlanPhotoIds();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const focusLater = useFocusAfterRender();
  const busy = adding || removing;

  async function add() {
    const file = input.current?.files?.[0];
    if (!file || busy) return;
    setAdding(true);
    setFailure(null);
    setConfirming(null);
    onStatus(STATUS.saving);
    const id = await upload(file);
    // G-20: cleared after every attempt, so the same file can be chosen again.
    if (input.current) input.current.value = "";
    if (id) {
      setIds([...ids, id]);
      onStatus(STATUS.saved);
      focusLater(canAddPhoto(ids.length + 1) ? PHOTO_ADD_ID : photoRemoveId(id));
    } else {
      setFailure(SAVE_FAILED);
      onStatus(null);
      focusLater(PHOTO_ADD_ID);
    }
    setAdding(false);
  }

  function askRemove(id: string) {
    setFailure(null);
    setConfirming(id);
    focusLater(photoCancelId(id));
  }

  function cancel(id: string) {
    setConfirming(null);
    focusLater(photoRemoveId(id));
  }

  async function remove(id: string) {
    if (busy) return;
    setRemoving(true);
    setFailure(null);
    const result = await gdmFetch(planPhotoPath(id), { method: "DELETE" });
    if (result.ok || result.status === 404) {
      // A 404 is a photo already gone (another tab): gone either way.
      setIds(ids.filter((kept) => kept !== id));
      setConfirming(null);
      onStatus(STATUS.removed);
      focusLater(PHOTO_ADD_ID); // below the cap now, so the add control is there
    } else {
      setFailure(SAVE_FAILED);
      focusLater(photoCancelId(id));
    }
    setRemoving(false);
  }

  if (state === "loading") return null;
  if (state === "failed") return <PhotosLoadFailed onRetry={retry} />;
  return (
    <>
      <PlanPhotoList
        ids={ids}
        adding={adding}
        confirming={confirming}
        busy={busy}
        onAdd={() => input.current?.click()}
        onAskRemove={askRemove}
        onRemove={(id) => void remove(id)}
        onCancel={cancel}
      />
      {canAddPhoto(ids.length) ? (
        <input ref={input} type="file" accept="image/*" hidden onChange={() => void add()} />
      ) : null}
      {failure ? (
        <p className="field-error" role="alert">
          {failure}
        </p>
      ) : null}
    </>
  );
}

/** Her photos as download links, each named `photoAlt` (G-62). None, nothing. */
export function PhotoDownloadLinks({ ids }: { ids: readonly string[] }) {
  return (
    <>
      {ids.map((id) => (
        <a key={id} className="secondary-button link-button" href={planPhotoSrc(id)} download>
          {CONTROLS.photoAlt}
        </a>
      ))}
    </>
  );
}

/**
 * G-62: on Your data, each photo downloads on its own, because the account
 * export lists a photo by its type and size instead of its bytes.
 */
export function PlanPhotoDownloads() {
  const { ids, state, retry } = usePlanPhotoIds();
  if (state === "failed") return <PhotosLoadFailed onRetry={retry} />;
  return <PhotoDownloadLinks ids={ids} />;
}
