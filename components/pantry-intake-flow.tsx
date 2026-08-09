"use client";

import { upload } from "@vercel/blob/client";
import { useState } from "react";

import { downscaleToJpeg } from "../lib/client/downscale";
import { PantryConfirmList } from "./pantry-confirm-list";

type Item = { id: string; name: string; portion: string | null };
type Phase =
  | "form"
  | "uploading"
  | "extracting"
  | "confirm"
  | "processing"
  | "needs_manual";

type PhotoSlot = {
  file: File;
  previewUrl: string;
  blobUrl: string | null;
  error: string | null;
};

const MAX_PHOTOS = 10;
const MAX_BYTES = 5 * 1024 * 1024;

const BAND_OPTIONS = [
  { value: "prediabetes_57_59", label: "5.7% – 5.9%" },
  { value: "prediabetes_60_62", label: "6.0% – 6.2%" },
  { value: "prediabetes_63_64", label: "6.3% – 6.4%" }
] as const;

const START_PHASE: Record<string, Phase> = {
  claimed: "form",
  submitted: "form",
  extracting: "extracting",
  awaiting_confirm: "confirm",
  processing: "processing",
  needs_manual: "needs_manual"
};

export function PantryIntakeFlow({
  orderId,
  initialStatus,
  initialItems,
  supportEmail
}: {
  orderId: string;
  initialStatus: string;
  initialItems: Item[];
  supportEmail: string;
}) {
  const [phase, setPhase] = useState<Phase>(START_PHASE[initialStatus] ?? "form");
  const [photos, setPhotos] = useState<PhotoSlot[]>([]);
  const [band, setBand] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [consented, setConsented] = useState(false);
  const [items, setItems] = useState<Item[]>(initialItems);
  const [failedPhotos, setFailedPhotos] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list).slice(0, MAX_PHOTOS - photos.length);
    for (const file of incoming) {
      const slot: PhotoSlot = {
        file,
        previewUrl: URL.createObjectURL(file),
        blobUrl: null,
        error: null
      };
      setPhotos((current) => [...current, slot]);
      try {
        const jpeg = await downscaleToJpeg(file);
        if (jpeg.size > MAX_BYTES) {
          throw new Error("That photo is too large even after resizing.");
        }
        const result = await upload(`pantry/${orderId}/photo.jpg`, jpeg, {
          access: "private",
          handleUploadUrl: "/api/pantry/upload",
          clientPayload: orderId,
          contentType: "image/jpeg"
        });
        setPhotos((current) =>
          current.map((entry) =>
            entry === slot ? { ...entry, blobUrl: result.url } : entry
          )
        );
      } catch {
        setPhotos((current) =>
          current.map((entry) =>
            entry === slot
              ? {
                  ...entry,
                  error:
                    "We couldn't read this photo — try a different one, or screenshot it first."
                }
              : entry
          )
        );
      }
    }
  }

  async function submit() {
    setFormError(null);
    const blobUrls = photos
      .map((photo) => photo.blobUrl)
      .filter((url): url is string => Boolean(url));
    if (blobUrls.length === 0) {
      setFormError("Add at least one photo of your pantry or a typical meal.");
      return;
    }
    if (!band) {
      setFormError("Pick the A1C range from your last lab result.");
      return;
    }
    if (!consented) {
      setFormError("The consent box above the button is needed to continue.");
      return;
    }
    setPhase("extracting");
    const response = await fetch("/api/pantry/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderId,
        photoUrls: blobUrls,
        a1cBand: band,
        notes: notes.trim() || undefined,
        consent: true
      })
    });
    if (!response.ok) {
      setPhase("form");
      setFormError(
        response.status === 429
          ? "A lot of photos are being read right now — try again in a few minutes."
          : "Something went wrong sending your photos. Nothing was lost — try again."
      );
      return;
    }
    const body = (await response.json()) as {
      status: string;
      items?: Item[];
      failedPhotos?: number;
    };
    if (body.status === "needs_manual") {
      setPhase("needs_manual");
      return;
    }
    setItems(body.items ?? []);
    setFailedPhotos(body.failedPhotos ?? 0);
    setPhase("confirm");
  }

  return (
    <main className="page-shell">
      <div className="page-frame">
        {phase === "form" || phase === "uploading" ? (
          <section className="surface-card form-card">
            <p className="hero-eyebrow">Pantry Review</p>
            <h1 className="page-title">Your Pantry Review</h1>
            <p className="page-copy">
              Add photos of your pantry, fridge, or typical meals — we read
              the items, you check the list, and your report arrives by
              email.
            </p>
            <div className="field-stack">
              <label htmlFor="photos" className="field-label">
                Photos ({photos.filter((photo) => photo.blobUrl).length} of {MAX_PHOTOS})
              </label>
              <input
                id="photos"
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="text-input"
                onChange={(event) => void addFiles(event.target.files)}
                disabled={photos.length >= MAX_PHOTOS}
              />
              <p className="field-hint">
                Real kitchens only — mess is normal, we only look at the food.
              </p>
              <ul className="pantry-thumb-row">
                {photos.map((photo, index) => (
                  <li key={index}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.previewUrl} alt={`Photo ${index + 1}`} width={64} height={64} />
                    {photo.error ? (
                      <p className="field-error">{photo.error}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
            <div className="field-stack">
              <label htmlFor="band" className="field-label">
                Your A1C range (from your last lab result)
              </label>
              <select
                id="band"
                className="text-input"
                value={band}
                onChange={(event) => setBand(event.target.value)}
              >
                <option value="">Choose a range</option>
                {BAND_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-stack">
              <label htmlFor="notes" className="field-label">
                Anything we should know? (optional)
              </label>
              <textarea
                id="notes"
                className="text-input"
                maxLength={500}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
            <div className="field-stack">
              {/* Purpose-bound health-data consent: unchecked by default,
                  blocking for the report, and revocable through Account. */}
              <label className="field-label pantry-consent">
                <input
                  type="checkbox"
                  checked={consented}
                  onChange={(event) => setConsented(event.target.checked)}
                />{" "}
                I explicitly consent to Prediabetes Pal collecting and using my A1C
                range, food details, notes, and pantry photos to prepare my
                Pantry Review. OpenAI, via the OpenRouter gateway, processes
                the photos and confirmed item text; Prediabetes Pal encrypts the saved
                health details. Photos are
                deleted after use. I can withdraw consent and erase claimed
                report data from Account.{" "}
                <a href="/privacy">How Prediabetes Pal handles health data</a>.
              </label>
            </div>
            {formError ? <p className="field-error">{formError}</p> : null}
            <button type="button" className="primary-button" onClick={() => void submit()}>
              Send photos for review
            </button>
          </section>
        ) : null}

        {phase === "extracting" ? (
          <section className="surface-card">
            <p className="status-copy" aria-live="polite">
              Reading your photos… this usually takes under a minute. Keep
              this page open.
            </p>
          </section>
        ) : null}

        {phase === "confirm" ? (
          <section className="surface-card form-card">
            <p className="hero-eyebrow">Check the list</p>
            <h1 className="page-title">Here&apos;s what we saw</h1>
            {failedPhotos > 0 ? (
              <p className="field-hint" aria-live="polite">
                {failedPhotos} photo{failedPhotos > 1 ? "s" : ""} couldn&apos;t
                be read — everything below came from the rest.
              </p>
            ) : null}
            <p className="page-copy">
              Here&apos;s what we saw — fix anything we got wrong.
            </p>
            <PantryConfirmList
              initialItems={items.map((item) => ({
                name: item.name,
                portion: item.portion ?? ""
              }))}
              onConfirm={async (confirmed) => {
                const response = await fetch("/api/pantry/confirm", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    orderId,
                    items: confirmed.map((item) => ({
                      name: item.name.trim(),
                      portion: item.portion.trim() || null
                    }))
                  })
                });
                if (!response.ok && response.status !== 409) {
                  throw new Error("confirm failed");
                }
                // Kick processing; the order also self-heals via the sweep if
                // this request dies with the tab (Task 2.12).
                void fetch("/api/pantry/process", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ orderId })
                });
                setPhase("processing");
              }}
            />
          </section>
        ) : null}

        {phase === "processing" ? (
          <section className="surface-card">
            <p className="status-copy" aria-live="polite">
              Your items are being reviewed. You&apos;ll get an email when the
              report is ready — it&apos;s safe to close this page.
            </p>
          </section>
        ) : null}

        {phase === "needs_manual" ? (
          <section className="surface-card">
            <p className="hero-eyebrow">Pantry Review</p>
            <h1 className="page-title">We&apos;ll take it from here</h1>
            <p className="page-copy">
              We couldn&apos;t read these photos automatically, so a person
              will review them by hand. Your report will arrive by email
              within 24 hours. Questions? {supportEmail}
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
