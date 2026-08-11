"use client";

import { useRef, useState } from "react";

import { fileToDataUrl } from "../lib/client/image";
import { requestPhotoDraft, type PhotoDraftResult } from "../lib/client/photo-draft";
import { IconCamera } from "./icons";

/** D5 photo-assist entry point. Native capture input — no camera library.
 *  The result is a DRAFT the user must review (photo-draft-review.tsx);
 *  this component never touches the verdict path. The taster gate runs in
 *  onRequestOpen BEFORE the file picker opens, so a walled taster never
 *  spends a draft call. */
export function PhotoInputButton({
  onDraft,
  onRequestOpen,
  disabled,
  premium
}: {
  onDraft: (result: PhotoDraftResult) => void;
  onRequestOpen: () => boolean; // false → gated (parent redirects); true → open picker
  disabled?: boolean;
  /** True → the chip carries a "Premium" tag: photo drafts are paid-only for
   *  this session, and tapping goes to the wall before any camera opens. */
  premium?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDrafting, setIsDrafting] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setIsDrafting(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      onDraft(await requestPhotoDraft(dataUrl));
    } catch {
      onDraft({
        kind: "error",
        message:
          "That photo couldn't be read. You can retake it, or just type or dictate the meal instead."
      });
    } finally {
      setIsDrafting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        data-testid="photo-file-input"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <button
        type="button"
        className="secondary-button method-chip"
        data-testid="photo-input-button"
        disabled={disabled || isDrafting}
        onClick={() => {
          if (disabled || isDrafting) return;
          if (onRequestOpen()) {
            inputRef.current?.click();
          }
        }}
      >
        <IconCamera size={20} />
        {isDrafting ? "Reading your photo..." : "Snap a photo"}
        {premium && !isDrafting ? (
          <span className="premium-tag" data-testid="photo-premium-tag">
            Premium
          </span>
        ) : null}
      </button>
    </>
  );
}
