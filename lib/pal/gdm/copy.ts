/**
 * The GDM door's Tier 1 copy bank (PRD GDM v1.1 §7.4: "Bounded banks, never
 * free generation, for every product-authored string").
 *
 * Keyed by copy-ledger Copy ID; each row is a record of NAMED strings, so a
 * component reads `GDM_COPY["gdm-door-name"].home`, never an index. The row's
 * strings IN DECLARATION ORDER are the ledger's Copy cell:
 * tests/unit/pal/gdm-copy.test.ts asserts the cell equals
 * `Object.values(row).join(" · ")`, so the ledger and the source cannot drift,
 * and that lib/gdm-door-flag.ts lists exactly these rows. Components import
 * from here and carry no literal copy of their own.
 *
 * Every row ships `Pending | Yes`, class `gdm-organiser`. Rules (PRD §8): no
 * sentence about a reading, a dose, a delivery decision, the pregnancy or the
 * baby; no digit; no grading word; nothing framed as a reduction.
 */
export const GDM_COPY = {
  "gdm-door-name": {
    name: "Gestational Diabetes Organiser",
    skip: "Skip to content",
    short: "Organiser"
  },
  "gdm-landing-hero": {
    line: "Told you have gestational diabetes and waiting for your dietitian? Keep your plan, your meals and your questions in one place, from today.",
    cta: "Sign up"
  },
  "gdm-landing-points": {
    plan: "A place for what your care team gives you, in their words.",
    meals: "A list of the meals you already eat, grouped the way your day runs.",
    asks: "Somewhere to put a question the moment you have it, ready for your appointment.",
    scope: "An organiser. No food guidance."
  },
  "gdm-landing-holding": {
    line: "You are signed in. The organiser is not open yet, and we cannot email you when it is. This page will show it as soon as it opens."
  },
  "gdm-disclaimer": {
    line: "This organiser keeps your own notes. It is informational only and is not medical advice. Your care team is the place for anything about your care."
  },
  "gdm-maker": {
    line: "From the makers of Prediabetes Pal."
  },
  "gdm-consent-required": {
    line: "Keeping your plan, meals and questions needs your explicit health-data consent."
  },
  // Task 1.4. G-34: `home` is the wordmark's destination; `plan`, `meals`,
  // `asks`, `summary` and `add` render as each later task adds its surface;
  // `data` sits in the frame's footer; `label` names the <nav>.
  "gdm-nav": {
    home: "Home",
    plan: "My plan",
    meals: "My meals",
    asks: "My questions",
    summary: "Summary",
    data: "Your data",
    add: "Add a question",
    label: "Organiser"
  },
  "gdm-onboarding-told": {
    ask: "Have you been told you have gestational diabetes?",
    yes: "Yes",
    notYet: "Not yet"
  },
  // PRD §7.2: who the door is for, and where questions about testing go —
  // nothing about tests, thresholds or what a result means.
  "gdm-onboarding-not-told": {
    line: "This organiser is built for people who have been told they have gestational diabetes. For questions about testing, your care team is the place to ask.",
    back: "Back"
  },
  // G-27: every step after the first can go back, so each has a `back` string.
  "gdm-onboarding-date": {
    ask: "When is your appointment?",
    hint: "Optional. It stays with your notes.",
    next: "Continue",
    skip: "Skip",
    back: "Back"
  },
  "gdm-onboarding-consent": {
    what: "What you keep here is health data. It is stored encrypted, only for you, and you can erase it at any time from Your data.",
    agree: "I agree to Gestational Diabetes Organiser storing the health data I enter.",
    go: "Agree and continue",
    notice: "How your data is handled",
    back: "Back"
  },
  "gdm-save-failed": {
    line: "That did not save just now. Try again in a moment."
  },
  // G-05: `eraseWarn` says what DELETE /api/account/health-data really erases —
  // the whole account's health data, the first door's included. R41:
  // `deleteBlocked` is the shared delete route's 409 (an active Google Play
  // subscription), where "try again in a moment" could never work.
  "gdm-data-controls": {
    title: "Your data",
    download: "Download my data",
    erase: "Erase my health data",
    eraseWarn:
      "This erases all the health data in your account, including everything you have kept here. It cannot be undone.",
    eraseGo: "Erase",
    deleteAccount: "Delete my account",
    deleteBlocked:
      "Your account was not deleted. Cancel your Google Play subscription first, then delete your account.",
    signOut: "Sign out",
    cancel: "Cancel"
  },
  // Counsel reads this row before `organiser` goes live (plan §1).
  "gdm-privacy-notice": {
    title: "How your data is handled",
    what: "What this organiser stores: that you have signed up here, your appointment date if you add one, and the plan, meals and questions you type or photograph.",
    how: "How it is stored: encrypted, tied to your account, and used only to show it back to you.",
    never:
      "What is never done with it: your words are not sent to an analytics service, and they are not used to build a profile of you.",
    choices:
      "Your choices: download it or erase it at any time from Your data. Erasing removes it from our database."
  },
  // G-36: the one polite live region each page carries. R40: the two
  // in-progress states take no full stop.
  "gdm-status": {
    saving: "Saving",
    saved: "Saved.",
    removed: "Removed.",
    loading: "Loading"
  },
  // G-15: app/gdm/(door)/error.tsx, so a database hiccup never shows Next's raw error page.
  "gdm-load-failed": {
    line: "That did not load just now.",
    retry: "Try again."
  },
  // G-14: the 409 body of POST /api/gdm/items at the per-kind cap, where
  // `gdm-save-failed`'s "try again in a moment" would be untrue.
  "gdm-list-full": {
    line: "This list is full. Delete an entry to add another."
  },
  // Task 2.2, F-ASKLIST. PRD §6.2: "The fixed line names the care team; it
  // says nothing else" — one sentence, nothing about what she asked.
  "gdm-asklist-lead": {
    line: "Your care team is the place these questions get answered."
  },
  // G-25: `empty` is the drafted empty state (warmth, one action, context),
  // not "Nothing here yet.". `cardTitle` heads the approved clinical copy the
  // items API returns for the four routes above the list; `remove` takes two
  // presses, the second beside `gdm-data-controls.cancel` (G-76).
  "gdm-asklist-controls": {
    title: "My questions",
    field: "Write your question",
    add: "Add",
    note: "Add a note about what you ate or what happened",
    asked: "Asked",
    answer: "What they said",
    save: "Save",
    remove: "Delete",
    empty: "No questions yet. Add one above whenever it comes to you.",
    cardTitle: "Before anything else"
  }
} as const satisfies Record<string, Record<string, string>>;
