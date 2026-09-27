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
  },
  // Task 3.2, F-PLANKEEP. One heading per GDM_OCCASIONS key (lib/pal/gdm/
  // plan-record.ts), in the order of her day. The bedtime snack is a heading,
  // never advice (PRD §6.1 row 11).
  "gdm-occasions": {
    breakfast: "Breakfast",
    snack_morning: "Morning snack",
    lunch: "Lunch",
    snack_afternoon: "Afternoon snack",
    dinner: "Dinner",
    snack_bedtime: "Bedtime snack"
  },
  // `counts` labels how her clinic counts, not "Unit" (a word in the copy
  // test's medication family). `grams`, `choices`, `servings` and `none` are
  // its four options, keyed by GDM_UNITS. `photoAdd` and `photoRemove` are the
  // sheet photo's controls (Task 3.3); R54: `photoAlt` names the photo itself,
  // since `photoAdd` names an action. G-25: `empty` is the drafted empty state.
  // R50: `addAnother` keeps a second sheet beside the first, never in its place.
  "gdm-plan-controls": {
    title: "My plan",
    sub: "In your care team's words.",
    givenBy: "Who gave you this",
    note: "What the sheet says",
    perDay: "Meals and snacks per day, as written",
    counts: "How my clinic counts",
    grams: "Grams",
    choices: "Choices",
    servings: "Servings",
    none: "None given",
    choiceMeans: "One choice is, as your sheet says",
    figure: "Figure for this occasion, exactly as written",
    save: "Save",
    replace: "Replace this plan",
    addAnother: "Add another plan",
    replacedOn: "Replaced on",
    enteredOn: "Entered on",
    photoAdd: "Add a photo of your sheet",
    photoRemove: "Remove photo",
    photoAlt: "Photo of your sheet",
    empty: "No plan here yet. When your care team gives you one, add it above."
  },
  // PRD §6.1 row 12: two current entries that differ are shown side by side and
  // never resolved. `askText` is the only product-authored sentence that lands
  // in her list: it says two entries differ and asks which stands. No clinician
  // is named and no entry is preferred.
  "gdm-plan-differ": {
    flag: "These differ",
    park: "Add to my questions",
    askText: "Two entries in my plan differ for {occasion}. Which one stands?"
  },
  // Task 4.2, F-WAIT. `quote` is ACOG's sentence, word for word, as PRD §6.2
  // pins it; the source sentence ends with a full stop that the pinned text
  // leaves out (G-24, for the safety owner). No quantity of any kind. Still
  // open under D5: if the safety owner refuses it, Home drops this part only.
  "gdm-wait-structure": {
    quote: "Often, three meals and two to three snacks per day are recommended",
    source: "American College of Obstetricians and Gynecologists (ACOG), patient FAQ on gestational diabetes"
  },
  // A plain list of organisational steps: never ticked, never counted.
  "gdm-wait-checklist": {
    book: "Book your diabetes educator or dietitian appointment.",
    cancellations: "Ask whether there is a cancellation list.",
    list: "Start a list of the meals you already eat.",
    asks: "Write your questions down as they come."
  },
  // Home's own words (G-32, G-37, G-69). The five phrases speak her date in
  // words, never as a count of days; `planTitle` heads her plan on Home.
  "gdm-wait-controls": {
    title: "While you wait",
    appointment: "Your appointment",
    today: "Today",
    tomorrow: "Tomorrow",
    thisWeek: "This week",
    nextWeek: "Next week",
    later: "Later on",
    changeDate: "Add or change the date",
    after: "Add what your care team gave you.",
    openPlan: "Open My plan",
    summaryOffer: "Your summary is ready to print.",
    planTitle: "My plan"
  },
  // Task 5.1, F-MYMEALS. G-70: one add form — `field`, the `occasion` select
  // (its options are `gdm-occasions`), `save` — and an occasion's heading only
  // once it holds a meal. `inSummary` is her choice to copy a meal into her
  // appointment summary; `remove` takes two presses, the second beside
  // `gdm-data-controls.cancel` (G-76). G-25: `empty` is the drafted empty state.
  // "Save", never that a meal worked or fits (PRD §6.2).
  "gdm-meals-controls": {
    title: "My meals",
    sub: "Meals you already eat, in your own words.",
    field: "Write a meal",
    occasion: "Which occasion",
    save: "Save",
    inSummary: "Include in my summary",
    remove: "Delete",
    empty: "No meals yet. Start with one you already eat."
  },
  // Task 6.1, F-SUMMARY. The summary organiser's headings for the three
  // sections: plan, meals, asks. Renders as app/gdm/(door)/summary/page.tsx.
  "gdm-summary-headings": {
    title: "For my appointment",
    plan: "My plan, as I understand it",
    meals: "What I usually eat",
    asks: "My questions",
    print: "Print",
    empty: "Nothing to print yet. Your plan, meals and questions appear here as you add them."
  }
} as const satisfies Record<string, Record<string, string>>;
