# Journal

Project history, newest first. Written by hand, one dated entry per
task — never generated.

## 2026-11-25

- UI redesign "neighbourhood market", slice 03, distribution table: built and reviewed on
  `feat/ui-market-distribution`, in its own worktree beside slice 04.
  - **The table.** The member search now lives in the layout, once. From 1024 px it is a
    400 px column on the left that stays in view; below that it sits above the page. Picking
    another member opens their page at once, and the open member is marked as current.
  - **A member's page.** It reads like the mockup: the name in Lora, the balance in a slate
    block, then "À remettre" with one card per order. Each card has one list of lines, which
    still shows why a line is not ready. Its kraft footer holds the total and a 72 px "Valider la
    remise". Warnings come next, in a squash box, then 72 px buttons for a payment and an express
    sale.
  - **Other screens.** The express sale, the receipt and the wallet dialogs follow the same look.
    Forced capitals and raw amber are gone.
  - **How it was built.** A Typist wrote a new browser test at 1194 and 768 px, seen red first at
    each of three steps. The review led to one shared receipt notice and the new translation keys
    in one block. The screenshots found cramped names in the search column, now fixed.
  - **Gates.** All five pass: 187 browser tests and 874 unit and API tests. One known flaky
    wallet test failed once in the full run and passed alone.
  - **Left open for the Architect.** The shared toasts are 13 px with colours from outside the
    theme; fixing that needs `packages/ui`. Four retro proposals wait in the work document.
  - The parent spec stays open for slice 04.

- UI redesign "neighbourhood market", slice 02, member space and sign-in: built and reviewed on
  `feat/ui-market-redesign`. Below 768 px the shop and member area now have a tab bar fixed at the
  bottom (Shop, Cart, Participation, My account; Sign in for visitors), with the current tab marked
  and the cart count on its icon. The top bar on a phone keeps the name and one "Menu" button for
  the settings, the back office and sign-out. From 768 px the top links are as before, with an icon
  each. CSS decides which bar shows, so both stay in the page: the phone controls have their own
  testids, and a test that looks a navigation word up by its text must scope its search. The awning
  band tops the shop, member area and sign-in pages; sign-in shows the name in Lora. The shop cards,
  the cart and the slot cards fit at 390 px, and the member screens lose forced capitals and raw
  colours. One new browser test at 390 px drives it, written step by step and seen red first. The
  usage limit stopped the first Typist after step 1; a second one did steps 3 to 5. The review led
  to one shared auth link and small fixes. The screenshots found a cut cart row the test had
  missed, because the table frame scrolls on its own; the check now looks there too. Inter is no
  longer loaded from Google Fonts. All five gates green (875 unit and API tests, 172 browser
  tests). Two older flaky tests failed once each and passed on the rerun: the accounting period
  test from slice 01, and a quick-add test of the cart that also fails without this slice's code.
  Six retro proposals wait for the human in the work document. The parent spec stays open for
  slices 03 and 04.

- UI redesign "neighbourhood market", slice 01, theme and shared components: built and reviewed on
  `feat/ui-market-redesign`. The Citrus theme is gone. The app now uses cream paper, ink-brown
  text, sage and squash actions, Lora headings and Onest text, with an evening mode on slate. The
  text scale is raised in the theme, so body text is 18 px and nothing is under 14 px. Buttons,
  fields, selects and tabs are 44 to 52 px high, with 2 px ink-brown borders and 12 px corners. A
  new awning band component waits for slices 02 to 04 to place it. Every text pair of both modes
  passes 4.5:1, and a new unit test in `packages/ui` checks it. A Typist coded it in four steps,
  each test written first and seen failing. The review found two real gaps, both fixed:
  destructive menu items unreadable at night, and four unused fields still too short. On the
  Architect's word, one class changed in the add-to-cart control, whose sage text was unreadable
  on slate. The final full runs are green (875 unit and API tests, 150 browser tests). Left open:
  a period-picker race found in the accounting screen, which predates the slice and needs its own
  task; the phone layout of the member space, for slice 02. The slice documents stay beside the
  parent spec, which is still open.

## 2026-11-24

- Lot 7, accounting and exports, the last delivery lot: built and reviewed on
  `feat/accounting-exports`. Admins record association expenses (rent, insurance, utilities,
  equipment, bank fees, other). The expense ledger is append-only: a mistake is cancelled once,
  with a reason, by an opposite row dated the day of the cancellation. Admins read a
  profit-and-loss account for any period, read in Paris time: sales and cost of goods sold come
  from handovers (express sales included, checked in the code), fees from fee payments, and
  wallet money stays off it. Five CSV files (wallet movements, sales, purchases, fees, expenses)
  match the account's figures and guard text against spreadsheet formulas. Three Typists coded
  it in seven steps, test first. The review found naming, typing and placement points, all fixed
  or answered in the work document. All five gates are green (726 API tests, 140 browser tests);
  one distribution test failed once with a 500 and passed on the rerun. Open for the human: two
  spec lines the Architect amended at the plan reading, and seven retro proposals in the spec.
  A six-check feature review then found 51 points (missing tests, copied code, return types,
  comments, French wording, a download revoked too early), all fixed on the human's word. The
  CSV writer and the download helper are now shared with the purchasing export, whose file stays
  byte for byte the same. 735 API tests and 143 browser tests green; two known flaky tests passed
  on the rerun. The report sits beside the spec.

- Lot 6, participation planning: built and reviewed on `feat/participation-planning`. Admins create,
  edit, cancel and delete time slots with a number of places. Members sign up while places are
  left, and leave until 7 days before the start. Admins can sign up or remove anyone until the slot
  ends. A member cannot hold two overlapping slots. The last place and the no-overlap rule hold
  under row locks on the member and the slot, proven by two service tests that fail without the
  lock (the HTTP test app has a pool of one connection, so it cannot prove a lock). The Typists
  coded it in nine steps, test first. The review found four standards points (mapper check,
  schema derivation, hand-written page meta, names), all fixed. All five gates are green (601 API
  tests, 132 browser tests). Fixed after the close, on the human's word: a cancelled slot can no
  longer be edited, the API refuses it with `slot_cancelled`. A six-check feature review then
  found 43 small points (missing tests, copied code, names, comments, French wording), all fixed:
  604 API tests and 135 browser tests green. The report sits beside the spec.

## 2026-11-23

- Lot 5, slice 03, refund, and the close of lot 5: built and reviewed on `feat/online-topup`. An
  admin can record money given back to a member. It is one negative ledger row, checked under a
  lock so it never goes beyond the balance, and nothing is sent to HelloAsso. The admins now get
  one e-mail when a top-up is paid short, once per top-up. The Typist coded it in four steps and
  the full suites are green (512 API tests, 123 browser tests). The two reviewers found nothing
  blocking. Open: some wallet tests fail now and then under load in a full run (seen in slices 02
  and 03, cause not found), and the human check against the real HelloAsso sandbox. The lot is
  closed: its spec and all slice documents are archived together in `project-management/archive/`.
- Lot 5, slice 02, payment correction and negative balance: built and reviewed on
  `feat/online-topup`. Staff can correct a payment typed by hand. The correction is a new
  reversing row, allowed once per payment, and it may leave the balance below zero. One purchase
  guard now refuses at the counter, for express orders, and in the online cart and checkout. A
  negative balance e-mails every admin and the member once. The Typist coded it in seven green
  commits with the full end-to-end suite. The review asked for typed refusal codes, now fixed.
  Left alone on purpose: the archived lot 4 files under `specs/` still say the balance is never
  negative. The underpaid top-up notice moved to slice 03.
- Lot 5, slice 01, online top-up through HelloAsso: built and reviewed on `feat/online-topup`.
  Members top up from the account page and are credited once HelloAsso confirms the payment.
  The Typist coded the plan, the HelloAsso facts came from a research file, and a two-reviewer
  review caught two real faults (an unknown payment state ended as a final failure, and a down
  provider was never throttled), both fixed. Open: the human check against the real HelloAsso
  sandbox, and two questions for the Architect (a refused card retried in the same checkout, and
  an underpaid payment that stays pending). Slices 02 and 03 are still to do.

## 2026-11-22

- chisel init: installed the dev-workflow socle.
