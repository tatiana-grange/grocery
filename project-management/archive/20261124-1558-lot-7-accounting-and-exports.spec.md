# Lot 7 — Accounting and exports

**Status:** done

---

> 🧑 **REVIEW CAREFULLY** — human decision surface. Read it all before code.

## Context

The treasurer and the board need to know whether the grocery makes or loses money, and the
accountant needs the raw figures. Today the app records sales, purchase costs, wallet
movements and membership fees, but it shows no result and exports nothing. It records no
other expense (rent, insurance, bank fees). Lot 7 adds that. It is the seventh and last
delivery lot of `apps/documentation/src/content/docs/project/architecture-plan.mdx`
(section "Delivery lots"), which plans an `accounting` module for "CSV exports,
profit-and-loss account". The feature list in
`apps/documentation/src/content/docs/project/monepi-features.mdx` asks for "open a
profit-and-loss account, association expenses" and "data exports".

## Scope

**Included:**

- An admin records an **association expense**: a date, an amount, a category from a fixed
  list (rent, insurance, utilities, equipment, bank fees, other), a label, and how it was
  paid. Expenses are append-only: a mistake is cancelled by a reversing row, with a reason,
  never by editing or deleting.
- An admin sees the list of expenses for a period.
- An admin sees a **profit-and-loss account** for a period they choose:
  - income: sales, membership fees;
  - costs: cost of goods sold, expenses split by category;
  - then the gross margin (sales minus cost of goods sold) and the result.
- An admin downloads five CSV files for a period: wallet movements, sales, purchases,
  membership fee payments, association expenses.
- Everything in lot 7 is for admins only.

**Not Included:**

- VAT. The app records no VAT rate, so every figure is as charged.
- A breakdown by product category or by month on the P&L.
- Wallet top-ups, payment corrections and refunds on the P&L: that money belongs to the
  members, held by the cooperative. It appears only in the wallet movements export.
- A balance sheet, a stock valuation, a bank reconciliation, or the French FEC file.
- Editable expense categories, attachments (receipts), or recurring expenses.
- A French-Excel CSV flavour (semicolons, decimal comma).

## Acceptance Criteria

- [x] **admin-only** — every lot 7 route refuses a member and a distributor; the screens are
      not reachable for them.
- [x] **expense-recorded** — an admin records an expense with date, amount, category, label
      and payment method; a zero or negative amount, or an unknown category, is refused.
- [x] **expense-append-only** — no route edits or deletes an expense. Cancelling one writes a
      reversing row that names the expense it cancels and carries a reason; an expense can be
      cancelled once only, and a reversing row cannot itself be cancelled.
- [x] **pnl-sales** — sales for a period are the sum of handover line totals in that period,
      reversal lines included (they are negative).
- [x] **pnl-cost-of-goods** — cost of goods sold for a period is the cost recorded on the
      stock movements written by handovers in that period, reversals included. Receptions do
      not count.
- [x] **pnl-fees** — membership fees for a period are the sum of fee payments and
      adjustments paid in that period.
- [x] **pnl-expenses** — expenses for a period are summed by category, reversing rows
      included; the result is sales plus fees minus cost of goods sold minus expenses.
- [x] **pnl-ignores-wallet** — a top-up, a payment received, a payment correction or a
      refund in the period changes no P&L figure.
- [x] **period-bounds** — a period is a start date and an end date, both included, read as
      calendar days in the cooperative's time zone (Europe/Paris); a start after the end is
      refused.
- [ ] ~~**five-csv-exports** — the five exports each return a CSV file with a header row and
      one row per record in the period, and their totals match the P&L figures for the same
      period.~~
- [x] **five-csv-exports** (amended 2026-11-24 by the Architect, confirmed by the human the same day: wallet
      movements and purchases are
      not on the P&L) — the five exports each return a CSV file with a header row and one row
      per record in the period. The sales, membership fees and expenses totals match the P&L
      figures for the same period; the wallet movements and purchases totals match the rows
      recorded in that period.
- [x] **csv-format** — comma separator, decimal point, amounts in euros with two decimals,
      ISO dates, UTF-8, values quoted when they hold a comma, a quote or a line break.
- [x] **csv-safe-for-spreadsheets** — a text value that starts with `=`, `+`, `-` or `@` is
      written so a spreadsheet does not run it as a formula.
- [x] **screens-for-admin** — in the SPA an admin records and cancels expenses, reads the
      P&L for a chosen period and downloads each export. Covered by the browser suite.
- [x] **suite-green** — `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and
      `pnpm e2e` all pass.

## Seams

- **Expense routes (admin)** — record, cancel, list for a period. Observable over HTTP.
- **P&L route (admin)** — the P&L for a period. Observable over HTTP against seeded sales,
  purchases, fees, wallet rows and expenses.
- **Export routes (admin)** — one CSV per export for a period. Observable over HTTP: status,
  content type, file name, body.
- **CSV writer** — one function turns a header and rows into CSV text, with quoting and the
  formula guard. Observable: a table of cases.
- **Period reader** — one function turns a start and end date into the two instants that
  bound the period in Europe/Paris. Observable: a table of cases, summer and winter time
  included.

## Architecture

**System design:** a new `accounting` module in the API, built like the other modules
(`apps/documentation/src/content/docs/references/backend.mdx`). It owns one new table, the
expenses, append-only like the wallet ledger (constitution, "Immutable Money and Stock
Ledgers"). The P&L and the exports only read the tables of the other modules (handover
lines, stock movements, reception lines, membership payments, wallet entries); they write
nothing there. The typed chain stays: Zod schemas, OpenAPI, generated client, then the SPA.
Every change to the database is a migration.

```
 handoverLine ─┐
 stockMovement ┼─► accounting: P&L for a period ──► admin P&L screen
 membershipPay ┤
 expense ──────┘
 + walletEntry, receptionLine ──► accounting: CSV exports ──► download
 admin ──► accounting: record / cancel expense ──► expense (append-only)
```

No "final" state is added except a cancelled expense: it is reached only by an admin
cancelling it, once, through the cancel route, and it is final because the expense ledger
is append-only.

---

> 🧑 **REVIEW IF RELEVANT** — decisions, testing, slicing.

## Implementation Decisions

- Decided with the human on 2026-11-24: a P&L plus an expenses ledger; cost of goods sold
  rather than purchases received; expenses append-only with a fixed category list; all
  five exports; standard CSV, not French-Excel style; admins only; short P&L with no
  breakdown by category or month; wallet money off the P&L.
- Amounts stay in cents in the database and the API, as everywhere else; the CSV writes
  euros with two decimals.
- A record belongs to the period by its own date: the handover's creation time (for its lines
  and their stock movements too, so one sale never splits across two periods; corrected by the
  Architect on 2026-11-24, confirmed by the human the same day), the reception's date, the fee payment's `paidAt`, the expense's date, the
  wallet entry's creation time.
- The expense payment methods are cash, cheque, transfer and card.
- The P&L screen opens on the current calendar year.
- A cancelled expense counts on the day it was cancelled, not on the expense's own date
  (Architect, 2026-11-24).
- To check while planning: that every sale goes through a handover (express orders
  included). If some sale does not, report it before coding.
- The `expense` table has `createdAt` and no `updatedAt`, a recorded deviation from the
  constitution's "Data rules": an append-only row is never updated, so an update time would only
  ever equal the creation time. `WalletEntry` and `StockMovement` make the same choice. The
  simpler alternative, an `updatedAt` column that never changes, was rejected as noise
  (Architect, 2026-11-24, after the feature review).

## Testing Strategy

- CSV writer and period reader with tables of cases, test first.
- Expense routes over HTTP: recording, refusals, cancelling once, roles.
- P&L route over HTTP against a seeded period with rows just inside and just outside both
  bounds, wallet rows that must not count, and a handover reversal.
- Each export over HTTP: header, rows, and a total that matches the P&L.
- Browser tests for recording and cancelling an expense, reading the P&L, and downloading
  one export.

## Slices & Dependencies

- **Sizing:** one pass. The three parts (expenses, P&L, exports) share the module, the
  period reader and the screens; cutting them would only add hand-offs.
- **Slices:** none. One branch: `feat/accounting-exports`, off `staging`.

## Deliverables

- [x] The `accounting` API module, its migration and tests.
- [x] The admin screens (expenses, P&L, exports) and the regenerated client.
- [x] A documentation page for lot 7, the glossary terms (association expense, cost of goods
      sold, profit-and-loss account) and the updated documentation index.

## References

- `apps/documentation/src/content/docs/project/architecture-plan.mdx`, "Delivery lots" and
  the module table — name lot 7 and the `accounting` module.
- `apps/documentation/src/content/docs/references/constitution.mdx`, "Immutable Money and
  Stock Ledgers" — the append-only rule the expense ledger follows.
- `apps/api/src/modules/inventory/entities/stock-movement.entity.ts` — explains how a
  handover's stock movement carries the cost of the goods sold.
- `project-management/archive/20261124-1022-lot-6-participation-planning.spec.md` — the lot
  6 spec, the closest example of form.

## Notes

## Retrospective

Written by the Mason at the close, 2026-11-24. Sources: this session, the reports of the four
Typists and reviewers (their full transcripts were not read back, so friction inside them is
known only from what they reported), the work document and the git log. Nothing here is applied;
each proposal waits for its owner. The `retro` skill asks for a `writing-great-skills` skill that
does not exist in this repo, so the step was skipped.

1. **Information access — rules kept outside the repo.** How to regenerate the client (a
   throwaway API needs `NODE_ENV=development` and `E2E` unset to serve `/api/docs.json`), that
   port 5111 belongs to another project, and the E2E gotchas live in a personal harness memory,
   against rule 8 of `.agents/discipline.md`. The frontend Typist had to rediscover the first one.
   Proposal: move them into `apps/documentation/src/content/docs/guides/generating-types.mdx`
   and `web-spa-e2e.mdx`. Owner: the human.
2. **Navigation — no example of a file download route.** Finding how `@lonestone/nzoth` handles a
   non-JSON answer took several searches (the package is only in the root `node_modules`).
   Proposal: one paragraph in `backend.mdx`, "Response Formatting": a download is a
   `@TypedRoute.Get` with no schema returning a `StreamableFile`, documented with
   `@ApiProduces`, see `accounting.controller.ts`. Owner: the human (living docs).
3. **Automated checks — `oxfmt` per folder still touches other files.** Formatting the docs
   project folder rewrote `lot-5-wallet.mdx`, which had to be reverted by hand. Proposal: format
   that page once in its own commit so the folder is clean, and say in `AGENTS.md` ("Formatting")
   to format changed files by name and check `git status` after. Owner: the human.
4. **Test first, in practice.** The first Typist wrote the P&L service before its test and had to
   unplug the controller to show red. Proposal: in the "Working with chisel in this repo" section
   of `AGENTS.md`, "write the step's first failing test file before any production file of the
   step". Owner: the human.
5. **A 🧑 criterion amended by the Architect.** The spec reviewer flagged that `five-csv-exports`
   was changed at the plan reading without a recorded word from the human. Proposal: say in
   `AGENTS.md` that a change to a 🧑 line carries the human's name and date, or waits for it.
   Owner: the human.
6. **A flaky test that answers 500.** `distribution.controller.e2e-spec.ts`, "refuses reversing a
   reversal", failed once with 500 instead of 409, then passed. The rule calls these known flaky,
   but a 500 is a server error, not slowness. Proposal: a `diagnosing-bugs` task, outside lot 7.
   Owner: the human.
7. **Parallel HTTP calls in one test.** Four parallel calls in one API test gave `ECONNRESET`
   (the test app has a pool of one connection, already met in lot 6). Proposal: one line in
   `apps/documentation/src/content/docs/guides/api-testing.mdx`: call routes one after the other
   inside a test. Owner: the human.
