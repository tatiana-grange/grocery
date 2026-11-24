# Lot 7 — Accounting and exports

**Status:** ready

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

- [ ] **admin-only** — every lot 7 route refuses a member and a distributor; the screens are
      not reachable for them.
- [ ] **expense-recorded** — an admin records an expense with date, amount, category, label
      and payment method; a zero or negative amount, or an unknown category, is refused.
- [ ] **expense-append-only** — no route edits or deletes an expense. Cancelling one writes a
      reversing row that names the expense it cancels and carries a reason; an expense can be
      cancelled once only, and a reversing row cannot itself be cancelled.
- [ ] **pnl-sales** — sales for a period are the sum of handover line totals in that period,
      reversal lines included (they are negative).
- [ ] **pnl-cost-of-goods** — cost of goods sold for a period is the cost recorded on the
      stock movements written by handovers in that period, reversals included. Receptions do
      not count.
- [ ] **pnl-fees** — membership fees for a period are the sum of fee payments and
      adjustments paid in that period.
- [ ] **pnl-expenses** — expenses for a period are summed by category, reversing rows
      included; the result is sales plus fees minus cost of goods sold minus expenses.
- [ ] **pnl-ignores-wallet** — a top-up, a payment received, a payment correction or a
      refund in the period changes no P&L figure.
- [ ] **period-bounds** — a period is a start date and an end date, both included, read as
      calendar days in the cooperative's time zone (Europe/Paris); a start after the end is
      refused.
- [ ] **five-csv-exports** — the five exports each return a CSV file with a header row and
      one row per record in the period, and their totals match the P&L figures for the same
      period.
- [ ] **csv-format** — comma separator, decimal point, amounts in euros with two decimals,
      ISO dates, UTF-8, values quoted when they hold a comma, a quote or a line break.
- [ ] **csv-safe-for-spreadsheets** — a text value that starts with `=`, `+`, `-` or `@` is
      written so a spreadsheet does not run it as a formula.
- [ ] **screens-for-admin** — in the SPA an admin records and cancels expenses, reads the
      P&L for a chosen period and downloads each export. Covered by the browser suite.
- [ ] **suite-green** — `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and
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
- A record belongs to the period by its own date: the handover's and the stock movement's
  creation time, the reception's date, the fee payment's `paidAt`, the expense's date, the
  wallet entry's creation time.
- The expense payment methods are cash, cheque, transfer and card.
- The P&L screen opens on the current calendar year.
- To check while planning: that every sale goes through a handover (express orders
  included). If some sale does not, report it before coding.

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

- [ ] The `accounting` API module, its migration and tests.
- [ ] The admin screens (expenses, P&L, exports) and the regenerated client.
- [ ] A documentation page for lot 7, the glossary terms (association expense, cost of goods
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
