"use client";

import { useEffect, useState } from "react";

import { RISK_LABELS } from "../lib/pal/labels";
import { mealMemoryUiEnabled } from "../lib/meal-memory-flag";
import {
  deleteAllMealMemories,
  deleteMealMemory,
  editMealMemory,
  MEMORY_EASE_OPTIONS,
  MEMORY_LABEL_OPTIONS,
  type MemoryEase,
  type MemoryEditInput,
  type MemoryLabel,
  type SavedMemory
} from "../lib/client/memory";

/**
 * The "Saved meals" section of /meals (C7 four-jobs merge, 2026-07-21).
 * Formerly the standalone /memory page; now the user-curated section above the
 * automatic Recent checks record so the two feel like one area. Renders
 * NOTHING when the meal-memory build flag is off, when the caller is a guest,
 * or when the server says the feature is unavailable — the flag-off /meals
 * page must carry zero "not on your plan" noise (plan §4). Errors are
 * section-scoped and never blank the sibling history list (design voice #7).
 *
 * Search deliberately lives on the page's Recent-checks filter, not here — the
 * saved list is short and scannable (DV7 decision).
 */

type SectionStatus = "loading" | "hidden" | "ready" | "error";

const EASE_LABEL = new Map(MEMORY_EASE_OPTIONS.map((o) => [o.value, o.label]));
const LABEL_LABEL = new Map(MEMORY_LABEL_OPTIONS.map((o) => [o.value, o.label]));

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
}

type EditDraft = {
  choice: string;
  note: string;
  wouldRepeat: "unset" | "yes" | "no";
  ease: MemoryEase | "";
  label: MemoryLabel | "";
  favorite: boolean;
};

function draftOf(memory: SavedMemory): EditDraft {
  return {
    choice: memory.choice ?? "",
    note: memory.note ?? "",
    wouldRepeat:
      memory.wouldRepeat === true
        ? "yes"
        : memory.wouldRepeat === false
          ? "no"
          : "unset",
    ease: memory.ease ?? "",
    label: memory.label ?? "",
    favorite: memory.favorite
  };
}

// Merge patch: every field is sent, so cleared text becomes null and an
// "unset" reflection clears to null. The server whitelist accepts only these
// user-authored fields.
function patchOf(draft: EditDraft): MemoryEditInput {
  return {
    choice: draft.choice.trim() ? draft.choice.trim() : null,
    note: draft.note.trim() ? draft.note.trim() : null,
    wouldRepeat:
      draft.wouldRepeat === "yes"
        ? true
        : draft.wouldRepeat === "no"
          ? false
          : null,
    ease: draft.ease === "" ? null : draft.ease,
    label: draft.label === "" ? null : draft.label,
    favorite: draft.favorite
  };
}

export function SavedMealsSection() {
  // Build flag inlined at build time (same on server + client render), so
  // seeding initial state from it is hydration-safe.
  const [status, setStatus] = useState<SectionStatus>(() =>
    mealMemoryUiEnabled() ? "loading" : "hidden"
  );
  const [memories, setMemories] = useState<SavedMemory[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  function parseMemoryPage(body: unknown): {
    memories: SavedMemory[];
    nextOffset: number | null;
  } {
    if (typeof body !== "object" || body === null) {
      return { memories: [], nextOffset: null };
    }
    const record = body as { memories?: SavedMemory[]; nextOffset?: unknown };
    return {
      memories: record.memories ?? [],
      nextOffset:
        typeof record.nextOffset === "number" ? record.nextOffset : null
    };
  }

  async function loadList(): Promise<void> {
    try {
      const response = await fetch("/api/memory");
      // Guest, flag-off, or not-entitled: the section simply does not exist —
      // the page around it carries the sign-in / retention states.
      if ([401, 403, 404].includes(response.status)) {
        setStatus("hidden");
        return;
      }
      if (!response.ok) {
        setStatus("error");
        return;
      }
      const page = parseMemoryPage(await response.json());
      setMemories(page.memories);
      setNextOffset(page.nextOffset);
      setLoadMoreError(false);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  async function onLoadMore(): Promise<void> {
    if (nextOffset === null || loadingMore) {
      return;
    }
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const response = await fetch(`/api/memory?offset=${nextOffset}`);
      if (!response.ok) {
        setLoadMoreError(true);
        return;
      }
      const page = parseMemoryPage(await response.json());
      setMemories((prev) => [...prev, ...page.memories]);
      setNextOffset(page.nextOffset);
    } catch {
      setLoadMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    if (!mealMemoryUiEnabled()) {
      return;
    }
    const initialLoad = window.setTimeout(() => void loadList(), 0);
    return () => window.clearTimeout(initialLoad);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function beginEdit(memory: SavedMemory): void {
    setActionError(null);
    setEditingId(memory.id);
    setDraft(draftOf(memory));
  }

  function cancelEdit(): void {
    setEditingId(null);
    setDraft(null);
  }

  async function saveEdit(id: string): Promise<void> {
    if (!draft) {
      return;
    }
    setActionError(null);
    const ok = await editMealMemory(id, patchOf(draft));
    if (!ok) {
      setActionError("Couldn't save that change. Please try again.");
      return;
    }
    cancelEdit();
    await loadList();
  }

  async function onDeleteOne(id: string): Promise<void> {
    setActionError(null);
    const ok = await deleteMealMemory(id);
    if (!ok) {
      setActionError("Couldn't delete that entry. Please try again.");
      return;
    }
    await loadList();
  }

  async function onDeleteAll(): Promise<void> {
    setActionError(null);
    const ok = await deleteAllMealMemories();
    setConfirmDeleteAll(false);
    if (!ok) {
      setActionError("Couldn't clear your saved meals. Please try again.");
      return;
    }
    await loadList();
  }

  if (status === "hidden" || status === "loading") {
    return null;
  }

  return (
    <section
      className="account-section"
      aria-label="Saved meals"
      data-testid="saved-meals-section"
    >
      <h2 className="section-title">Saved meals</h2>
      <p className="result-disclaimer" data-testid="memory-page-explainer">
        Your saved meals are yours. They never change how Prediabetes Pal checks a meal
        — only your current meal description affects a check, never your notes.
      </p>

      {status === "error" ? (
        <p className="placeholder-copy" data-testid="memory-error">
          Something went wrong loading your saved meals. Please try again.
        </p>
      ) : (
        <>
          <div className="memory-controls">
            <a
              className="recheck-button"
              href="/api/memory/export"
              download
              data-testid="memory-export"
            >
              Export saved meals
            </a>
          </div>

          {actionError ? (
            <p className="placeholder-copy" data-testid="memory-action-error">
              {actionError}
            </p>
          ) : null}

          {memories.length === 0 ? (
            <p className="placeholder-copy" data-testid="memory-empty">
              Nothing saved yet. Save a check and it shows up here.
            </p>
          ) : (
            <ul className="memory-list" data-testid="memory-list">
              {memories.map((memory) => (
                <li
                  key={memory.id}
                  className="memory-item"
                  data-testid="memory-item"
                >
                  <div className="memory-item-head">
                    <span className="memory-food">
                      {memory.favorite ? (
                        <span aria-label="Favorite" title="Favorite">
                          ★{" "}
                        </span>
                      ) : null}
                      {memory.food ?? "(unreadable entry)"}
                    </span>
                    <span
                      className="risk-chip"
                      data-risk={memory.risk}
                      data-testid="memory-band"
                    >
                      {RISK_LABELS[memory.risk]}
                    </span>
                  </div>
                  <p className="memory-date">{formatDate(memory.createdAt)}</p>

                  {editingId === memory.id && draft ? (
                    <div className="memory-edit" data-testid="memory-edit">
                      <label className="field-label">
                        Chose
                        <input
                          className="text-input"
                          type="text"
                          value={draft.choice}
                          maxLength={200}
                          onChange={(event) =>
                            setDraft({ ...draft, choice: event.target.value })
                          }
                        />
                      </label>
                      <label className="field-label">
                        Note
                        <input
                          className="text-input"
                          type="text"
                          value={draft.note}
                          maxLength={500}
                          onChange={(event) =>
                            setDraft({ ...draft, note: event.target.value })
                          }
                        />
                      </label>
                      <label className="field-label">
                        Again?
                        <select
                          className="text-input"
                          value={draft.wouldRepeat}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              wouldRepeat: event.target
                                .value as EditDraft["wouldRepeat"]
                            })
                          }
                        >
                          <option value="unset">—</option>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      </label>
                      <label className="field-label">
                        Felt
                        <select
                          className="text-input"
                          value={draft.ease}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              ease: event.target.value as EditDraft["ease"]
                            })
                          }
                        >
                          <option value="">—</option>
                          {MEMORY_EASE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field-label">
                        Label
                        <select
                          className="text-input"
                          value={draft.label}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              label: event.target.value as EditDraft["label"]
                            })
                          }
                        >
                          <option value="">—</option>
                          {MEMORY_LABEL_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field-label field-label--inline">
                        <input
                          type="checkbox"
                          checked={draft.favorite}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              favorite: event.target.checked
                            })
                          }
                        />
                        Favorite
                      </label>
                      <div className="memory-item-buttons">
                        <button
                          type="button"
                          className="primary-button"
                          data-testid="memory-save"
                          onClick={() => void saveEdit(memory.id)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="recheck-button"
                          onClick={cancelEdit}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {memory.choice ? (
                        <p
                          className="memory-field"
                          data-testid="memory-item-choice"
                        >
                          <strong>Chose:</strong> {memory.choice}
                        </p>
                      ) : null}
                      {memory.wouldRepeat !== null ? (
                        <p className="memory-field">
                          <strong>Again?</strong>{" "}
                          {memory.wouldRepeat ? "Yes" : "No"}
                        </p>
                      ) : null}
                      {memory.ease ? (
                        <p className="memory-field">
                          <strong>Felt:</strong> {EASE_LABEL.get(memory.ease)}
                        </p>
                      ) : null}
                      {memory.label ? (
                        <p className="memory-field">
                          <strong>Label:</strong> {LABEL_LABEL.get(memory.label)}
                        </p>
                      ) : null}
                      {memory.note ? (
                        <p
                          className="memory-field"
                          data-testid="memory-item-note"
                        >
                          <strong>Note:</strong> {memory.note}
                        </p>
                      ) : null}
                      <div className="memory-item-buttons">
                        <button
                          type="button"
                          className="recheck-button"
                          data-testid="memory-edit-button"
                          onClick={() => beginEdit(memory)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="recheck-button"
                          data-testid="memory-delete-button"
                          onClick={() => void onDeleteOne(memory.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          {nextOffset !== null ? (
            <div className="memory-load-more">
              <button
                type="button"
                className="recheck-button"
                data-testid="memory-load-more"
                onClick={() => void onLoadMore()}
                disabled={loadingMore}
              >
                {loadingMore
                  ? "Loading…"
                  : loadMoreError
                    ? "Couldn't load more — Retry"
                    : "Load more"}
              </button>
              {loadMoreError ? (
                <p
                  className="placeholder-copy"
                  data-testid="memory-load-more-error"
                >
                  Something went wrong loading more. Your saved meals are safe
                  — try again.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="memory-danger" data-testid="memory-delete-all">
            {confirmDeleteAll ? (
              <>
                <p className="placeholder-copy">
                  Delete everything you&apos;ve saved? This can&apos;t be
                  undone.
                </p>
                <div className="memory-item-buttons">
                  <button
                    type="button"
                    className="recheck-button"
                    data-testid="memory-delete-all-confirm"
                    onClick={() => void onDeleteAll()}
                  >
                    Yes, delete all my saved meals
                  </button>
                  <button
                    type="button"
                    className="recheck-button"
                    onClick={() => setConfirmDeleteAll(false)}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                className="recheck-button"
                data-testid="memory-delete-all-start"
                onClick={() => setConfirmDeleteAll(true)}
                disabled={memories.length === 0}
              >
                Delete all my saved meals
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
