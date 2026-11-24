# Lot 7 — Accounting and exports — work

Created by the Mason at the plan step, 2026-11-24. Spec:
`project-management/tasks/20261124-1558-lot-7-accounting-and-exports.spec.md`.

**Plan:** approved by the Architect, 2026-11-24, with the corrections below.

Read before planning: `AGENTS.md` (with "Working with chisel in this repo"), `.agents/workflow.md`,
`.agents/discipline.md`, and the reading list of `.agents/project.md` (README, documentation
index, general, backend and frontend guidelines, constitution, `CONTRIBUTING.md`, `.cursor/rules/`,
the latest journal entries). The closest models are the lot 6 work document, the wallet module
(append-only ledger, reversing row, typed refusals) and the lot 6 admin screens.

## Program Design

### 1. The open check: does every sale go through a handover?

**Yes.** Checked in the code on 2026-11-24:

- `DistributionService` writes a `Handover` in exactly two places: the ordinary handover of an
  order, and the express sale. The express sale first creates an `Order` and its `OrderLine`s,
  then a `Handover` with its `HandoverLine`s, exactly like an ordinary handover
  (`handover.entity.ts` says so too: "Every handover hangs off a real Order, express sales
  included").
- `WalletService.charge` with reason `handover_charge` is called from those two places only.
  The online shop checkout charges nothing: an online order is paid when it is handed over.
- `InventoryService.recordIssue` (the stock movement with reason `distribution`) is called from
  those two places only. `recordIssueReversal` (reason `distribution_reversal`) is called only
  from `reverseHandover`.
- The other wallet reasons (`payment_received`, `online_topup`, `payment_correction`, `refund`)
  move member money, not goods.

So "sales = handover lines" and "cost of goods sold = stock movements written by handovers" cover
every sale. Nothing to report against the spec here.

One fact found on the way, for the documentation: a product sold before any reception has no
average cost, so its stock movement is written at a cost of 0 (`recordIssue`). Its cost of goods
sold is then 0 on the P&L. This is lot 4 behaviour, not changed here; the lot 7 page says it.

### 2. Decisions in one place

- **One new table, `expense`, append-only.** A row is never edited or deleted. A cancellation is
  a second row with a negative amount that points at the expense it cancels. `createdAt` only, no
  `updatedAt`, the same recorded deviation as `WalletEntry` and `StockMovement` (a ledger row is
  never updated, so an update time would only ever equal the creation time).
- **Amounts in cents, signed.** An expense row is positive. Its cancellation row is the same
  amount, negative. The P&L sums the column. The API takes and returns cents (spec). The SPA form
  takes euros and converts.
- **The expense date is a calendar day**, stored in a `date` column (`spentOn`, a `YYYY-MM-DD`
  string in the API). It has no time and no time zone, so it is compared to the period's start and
  end days directly. A future date is allowed (rent paid ahead).
- **The cancellation row's date is the day it was cancelled**, in Europe/Paris, not the date of
  the expense it cancels. Reason: a handover reversal counts on its own day too (criterion
  `pnl-sales`), and a P&L already given to the board for a past period does not change
  afterwards. The category, label and payment method are copied from the expense. **This is a
  choice the spec left open. See the questions.**
- **A cancellation is written once.** A unique index on `cancelsExpenseId` backs the rule
  (like `correctsEntryId` on the wallet). A unique violation is turned into the refusal
  `already_cancelled`, as `correctPayment` does for `already_corrected`.
- **The period** is two calendar days, `from` and `to`, both included, read in Europe/Paris. The
  period reader turns them into a half-open pair of instants: `startsAt` = Paris midnight at the
  start of `from`, `endsBefore` = Paris midnight at the start of the day after `to`. A row with a
  time belongs to the period when `startsAt <= time < endsBefore`. `from` after `to` is refused
  with 400 by the query schema. A day that does not exist (`2026-02-30`) is refused with 400.
- **No date library.** The API has none. The period reader finds the Paris offset with
  `Intl.DateTimeFormat` (Node 24 ships the full time zone data). Paris changes the clock at 02:00
  or 03:00, never at midnight, so every Paris midnight exists once and only once.
- **Which date puts a record in the period** (spec, Implementation Decisions), with one
  refinement:
  - sales and cost of goods sold: **the handover's `createdAt`**, for its lines and for their
    stock movements. Reason: the handover, its lines and their stock movements are written in one
    transaction, but each gets its own `new Date()` a few milliseconds apart. Filtering each on
    its own time could put a line in one period and its cost in the next, near midnight, and the
    sales export would then disagree with the P&L. The criterion `pnl-cost-of-goods` already says
    "stock movements written by handovers in that period". **The Implementation Decisions line
    says "the stock movement's creation time". See the questions.**
  - membership fees: `membershipPayment.paidAt` (an instant).
  - expenses: `expense.spentOn` (a day).
  - wallet movements: `walletEntry.createdAt`.
  - purchases: `reception.receivedAt` for its lines.
- **Cost of goods sold** = for each stock movement with reason `distribution` or
  `distribution_reversal`, `-(quantity × unitCostAmountCents)`, rounded to the cent **per row**,
  then summed. The quantity is a decimal (sale by weight), so a row's cost can hold fractions of a
  cent. Rounding per row makes the sales export's cost column add up to exactly the P&L figure.
  Rounding is done once, in SQL, with `round()` (half away from zero). A reversal row has the
  opposite quantity and the same unit cost, so its rounded cost is exactly the opposite. Receptions
  do not count.
- **Sales** = sum of `handoverLine.lineTotalAmountCents` (reversal lines are already negative).
- **Membership fees** = sum of `membershipPayment.amountCents`, both kinds (`payment` and
  `adjustment`).
- **Expenses** = sum of `expense.amountCents` by category, cancellation rows included. All six
  categories are always listed, with 0 when empty, so the screen and the tests have a fixed shape.
- **Gross margin** = sales − cost of goods sold. **Result** = sales + fees − cost of goods sold −
  expenses.
- **The P&L reads no wallet row.** No query of the P&L touches `walletEntry`. Criterion
  `pnl-ignores-wallet` is proven by a test that seeds every non-sale wallet reason in the period.
- **The P&L is summed by the database; the exports read rows.** Both build their period filter
  and the per-row cost expression from one file (`accounting.queries.ts`), so they cannot drift.
  A test per export checks that its total equals the matching P&L figure.
- **Exports are whole files, not pages.** One query per export for the period, built in memory,
  sent as one response. A year of a single cooperative is tens of thousands of rows at most. No
  streaming in this lot.
- **The CSV format** (spec, criterion `csv-format`): comma, decimal point, a header row, UTF-8,
  no byte order mark, lines ended by `\r\n` (RFC 4180). A value is quoted when it holds a comma, a
  quote, a `\r` or a `\n`; a quote inside is doubled. Amounts are euros with two decimals
  (`-12.50`). Quantities are plain decimals (`1.5`). Every row carries a `date` column, the Paris
  calendar day that put it in the period (ISO `YYYY-MM-DD`); rows that have a time also carry a
  `recordedAt` column, the ISO 8601 instant in UTC.
- **The formula guard** (criterion `csv-safe-for-spreadsheets`): a **text** cell that starts with
  `=`, `+`, `-`, `@`, a tab or a carriage return gets a single quote `'` in front, then the usual
  quoting. The tab and carriage return are added to the spec's four because the OWASP guidance on
  CSV injection lists them too. Numbers and amounts are never guarded, so `-12.50` stays a number.
  The writer knows a text cell from an amount by its type (section 4).
- **The export answer.** Status 200, `Content-Type: text/csv; charset=utf-8`,
  `Content-Disposition: attachment; filename="grocery-<export>-<from>-<to>.csv"`. Returned as a
  NestJS `StreamableFile` from a `@TypedRoute.Get` with no response schema (nzoth then applies a
  plain route, so no JSON check runs on the text), documented with `@ApiProduces('text/csv')` and
  an `@ApiOkResponse` whose content is `text/csv`, type string. The generated fetch client reads a
  `text/*` answer as text.
- **Who may call what.** Every lot 7 route is `@AdminOnly()` under `AuthGuard`. A member or a
  distributor gets 403, no session gets 401. The SPA screens live in the back office, whose layout
  already sends a non-admin away.
- **Refusals are 409 with a `code`**, through `refusal()` from `common/refusal.ts`, with the codes
  in a typed list in the contract (`EXPENSE_CANCEL_REFUSALS`).
- **Pagination.** The expense list is paginated with the `@lonestone/nzoth` helpers, default page
  size 50, newest day first. The P&L and the exports are not lists.

### 3. Files and interfaces, backend

New module `apps/api/src/modules/accounting/`, built like `wallet/` and `participation/`
(backend guidelines, "Module Structure"; constitution, "Module Boundaries"):

```
accounting/
  accounting.module.ts
  accounting.controller.ts          AdminExpensesController, AdminAccountingController
  expenses.service.ts               record, cancel, list
  profit-and-loss.service.ts        the P&L sums
  exports.service.ts                the five row readers and their CSV columns
  accounting.queries.ts             period filters and the per-row cost expression, shared
  accounting.mapper.ts
  period.util.ts                    the period reader, pure
  csv.util.ts                       the CSV writer, pure
  contracts/expense.contract.ts
  contracts/accounting.contract.ts  period query, P&L, export names
  entities/expense.entity.ts
  tests/period.util.spec.ts
  tests/csv.util.spec.ts
  tests/accounting-test-data.ts     helpers that insert rows at a chosen time
  tests/expenses.controller.e2e-spec.ts
  tests/profit-and-loss.controller.e2e-spec.ts
  tests/exports.controller.e2e-spec.ts
```

Also changed:

- `apps/api/src/app.module.ts`: import `AccountingModule`.
- `apps/api/src/seeders/e2e.seeder.ts`: two expenses dated today (section 8).
- One migration under `apps/api/src/modules/db/migrations/` (section 5).

**Entity** (`entities/expense.entity.ts`):

```ts
@Entity({ tableName: 'expense' })
class Expense {
  id: string // uuid, gen_random_uuid()
  spentOn: string // @Property({ type: 'date' }), @Index(); 'YYYY-MM-DD'
  amountCents: number // positive on an expense, negative on a cancellation, never 0
  category: ExpenseCategory
  label: string // length 200
  paymentMethod: ExpensePaymentMethod
  kind: ExpenseKind // 'expense' | 'cancellation'
  cancelsExpense?: Rel<Expense> // ManyToOne, fieldName 'cancelsExpenseId', nullable, @Unique()
  reason?: string // length 500, set only on a cancellation
  recordedByUser: Rel<User> // ManyToOne, fieldName 'recordedByUserId'
  createdAt: Date
}
```

The Typist checks in the first expense test that MikroORM 7 hands `spentOn` back as a
`'YYYY-MM-DD'` string. If it hands back a `Date`, it uses `columnType: 'date', type: 'string'`
instead, and writes it in the worklog.

**Contracts.** Every schema with `.meta()`, its inferred type next to it.

`contracts/expense.contract.ts`:

- `EXPENSE_CATEGORIES = ['rent', 'insurance', 'utilities', 'equipment', 'bank_fees', 'other']`,
  `EXPENSE_PAYMENT_METHODS = ['cash', 'cheque', 'transfer', 'card']`,
  `EXPENSE_KINDS = ['expense', 'cancellation']`, each through `z.enum(...).meta()`.
- `EXPENSE_CANCEL_REFUSALS = ['already_cancelled', 'cannot_cancel_cancellation']`.
- `expenseSchema`: `{ id, spentOn, amountCents, category, label, paymentMethod, kind,
cancelsExpenseId: string | null, cancelledByExpenseId: string | null, isCancelled, reason:
string | null, recordedByName, createdAt }`. `isCancelled` and `cancelledByExpenseId` are read,
  not stored: an expense row is cancelled when a cancellation row points at it.
- `recordExpenseSchema`: picked from the base, `{ spentOn, amountCents, category, label,
paymentMethod }`. `amountCents` a whole number from 1 to 2 147 483 647 (the `int` column).
  `label` trimmed, 1 to 200 characters. `spentOn` a real calendar day. Unknown fields are
  stripped (zod default), so `kind` or `cancelsExpenseId` in the body has no effect.
- `cancelExpenseSchema`: `{ reason }`, trimmed, 1 to 500 characters.
- `expenseListSchema` through `paginatedSchema`; `expensePaginationSchema` through
  `createPaginationQuerySchema({ defaultPageSize: 50 })`.

`contracts/accounting.contract.ts`:

- `calendarDaySchema`: a `YYYY-MM-DD` string that is a real day. Shared by the expense date and
  the period.
- `periodQuerySchema`: `{ from: calendarDay, to: calendarDay }`, both required, with
  `.refine(from <= to)`, read with `@TypedQueryObject`.
- `profitAndLossSchema`: `{ from, to, salesCents, costOfGoodsSoldCents, grossMarginCents,
membershipFeesCents, expensesByCategory: { category, amountCents }[], expensesTotalCents,
resultCents }`.
- `EXPORT_NAMES = ['wallet-movements', 'sales', 'purchases', 'membership-fees', 'expenses']`,
  `exportNameSchema` through `z.enum(...).meta()`.

**Routes**

| Route                                              | Who   | Does                                                       | Refused with                                                              |
| -------------------------------------------------- | ----- | ---------------------------------------------------------- | ------------------------------------------------------------------------- |
| `GET admin/expenses?from&to&offset&pageSize`       | admin | expense and cancellation rows by day                       | 400 bad period; 401; 403                                                  |
| `POST admin/expenses`                              | admin | record an expense, answers it (201)                        | 400 bad body                                                              |
| `POST admin/expenses/:expenseId/cancel`            | admin | write the cancellation, answers the expense, now cancelled | 404; 409 `already_cancelled`, `cannot_cancel_cancellation`; 400 no reason |
| `GET admin/accounting/profit-and-loss?from&to`     | admin | the P&L for the period                                     | 400 bad period                                                            |
| `GET admin/accounting/exports/:exportName?from&to` | admin | one CSV file                                               | 400 bad period or unknown export name                                     |

No `PUT`, `PATCH` or `DELETE` on expenses, ever.

**Service seams** (signatures):

```ts
class ExpensesService {
  constructor(em: EntityManager)
  record(input: RecordExpenseInput, recordedByUserId: string): Promise<Expense>
  cancel(p: {
    expenseId: string
    reason: string
    recordedByUserId: string
    now?: Date
  }): Promise<Expense>
  list(p: { period: Period } & Pagination): Promise<{ items: ExpenseRow[]; total: number }>
}
// ExpenseRow = { expense: Expense; cancelledByExpenseId: string | null }

class ProfitAndLossService {
  constructor(em: EntityManager)
  compute(period: Period): Promise<ProfitAndLoss> // plain object, mapped to the contract
}

class ExportsService {
  constructor(em: EntityManager)
  build(p: { exportName: ExportName; period: Period }): Promise<{ fileName: string; csv: string }>
}
```

`Period` is `{ from: string; to: string; startsAt: Date; endsBefore: Date }`, made by the period
reader in the controller and handed to the services.

`cancel`, inside `em.transactional`: find the row (404), refuse `cannot_cancel_cancellation` when
its kind is `cancellation`, refuse `already_cancelled` when a row already points at it, write the
cancellation (`spentOn` = Paris day of `now`, amount negated, category, label and payment method
copied, reason, recorded by), flush; a unique violation on `cancelsExpenseId` becomes
`already_cancelled`. `now` defaults to `new Date()`; the test passes it to pin the day.

**SQL.** Aggregates and export rows go through `em.getConnection().execute(sql, params)`, as
`InventoryService.getStockLevels` does, with bound parameters only. `accounting.queries.ts` holds:

- `HANDOVER_IN_PERIOD` — `h."createdAt" >= ? and h."createdAt" < ?`
- `LINE_COST_CENTS` — `round(-sm."quantity" * sm."unitCostAmountCents")` over
  `stockMovement sm join handoverLine hl on sm."handoverLineId" = hl.id join handover h on ...`,
  with `sm."reason" in ('distribution', 'distribution_reversal')`.

### 4. The two pure seams

`period.util.ts`:

```ts
export const COOPERATIVE_TIME_ZONE = 'Europe/Paris'
export interface PeriodBounds {
  startsAt: Date
  endsBefore: Date
}
export function readPeriod(p: { from: string; to: string }): PeriodBounds
export function startOfParisDay(day: string): Date
export function toParisDay(instant: Date): string // 'YYYY-MM-DD'
export function isCalendarDay(value: string): boolean
```

`readPeriod` throws a `RangeError` when `from > to`, as a last guard; the query schema refuses it
first with 400.

`csv.util.ts`:

```ts
export interface CsvAmount {
  cents: number
} // written as euros, two decimals
export type CsvCell = string | number | CsvAmount | null // string = text, guarded
export function toCsv(p: { header: string[]; rows: CsvCell[][] }): string
export function formatEuros(cents: number): string // 1234 -> '12.34', -5 -> '-0.05', 0 -> '0.00'
```

`formatEuros` works on whole cents with integer maths (no `toFixed` on a float). `null` is an
empty cell. A `number` is written with `String()`. A `string` is guarded, then quoted if needed.

### 5. Migration

One migration, `pnpm --filter=api db:migrate:create`, then read the SQL first. Expected shape, to
compare with what MikroORM writes (not pasted by hand):

```sql
create table "expense" ("id" uuid not null default gen_random_uuid(), "spentOn" date not null,
  "amountCents" int not null, "category" varchar(255) not null, "label" varchar(200) not null,
  "paymentMethod" varchar(255) not null, "kind" varchar(255) not null default 'expense',
  "cancelsExpenseId" uuid null, "reason" varchar(500) null, "recordedByUserId" uuid not null,
  "createdAt" timestamptz not null, primary key ("id"));
create index "expense_spentOn_index" on "expense" ("spentOn");
alter table "expense" add constraint "expense_cancelsExpenseId_unique" unique ("cancelsExpenseId");
alter table "expense" add constraint "expense_cancelsExpenseId_foreign" foreign key ("cancelsExpenseId") references "expense" ("id") ...;
alter table "expense" add constraint "expense_recordedByUserId_foreign" foreign key ("recordedByUserId") references "user" ("id") ...;
```

Rules from `AGENTS.md`, "Generated migrations":

- Before writing the file, run `pnpm --filter=api exec mikro-orm schema:update --dump` against a
  migrated database to see the difference.
- Remove from `up` and `down` every `drop index` / `create index` line for the eight
  `*_search_idx` indexes, and any other line that is not the `expense` table. Write in the worklog
  what was removed and how many lines. Never declare those indexes on the entities.
- No check constraint written by hand (amount not zero, cancellation has a reason): the contract
  and the service check them. A hand-written check is not on the entity and would come back as a
  difference on the next generated migration.
- The test database is built from the entities and the E2E database by `schema:fresh`, so both
  get the table with no extra step. The E2E reset truncates every table not in its protected list,
  so `expense` is cleaned with no change to `test-seed.service.ts`.
- The dev database gets the migration as a delta by hand if its tracking lags (the project note
  on dev database migrations). The dev database port 5111 belongs to another project; manual
  checks use the E2E stack.

### 6. The one "final" state, and why

An expense with a cancellation row pointing at it is cancelled, and that is final.

Why final: the expense ledger is append-only (constitution, "Immutable Money and Stock
Ledgers"). Undoing a cancellation would need a third row cancelling the cancellation, which the
spec forbids ("a reversing row cannot itself be cancelled"). An admin who cancelled by mistake
records the expense again.

Every input that can reach it, and nothing else:

1. `POST admin/expenses/:expenseId/cancel`, by an admin, on an expense row that is not itself a
   cancellation and has no cancellation yet.

Doors that must stay closed, one test each (step 3):

- `POST admin/expenses` with `kind: 'cancellation'` and `cancelsExpenseId` in the body records a
  plain expense and cancels nothing (the fields are stripped).
- No `PUT`, `PATCH` or `DELETE` route on `admin/expenses/:expenseId` (404).
- Cancelling a cancellation row is refused with `cannot_cancel_cancellation`.
- A second cancel is refused with `already_cancelled`, and there is still one cancellation row.
- The E2E seeder writes no cancellation.

A second input found in the diff is a defect. The Mason and the reviewers check this list.

### 7. Steps and tests (vertical, each step ends in a commit)

For each step the first failing test is named. The Typist shows it red, then green, and writes
the red run in the worklog. A step with no red test is reported, not ticked. Backend tests follow
Arrange-Act-Assert, test members come from `createMemberData`, test names say the rule. Browser
test names are in French, like the existing ones.

**Step 1. The period reader and the CSV writer.** Files: `period.util.ts`, `csv.util.ts`,
`tests/period.util.spec.ts`, `tests/csv.util.spec.ts`. Pure, no database.

- First failing test: `reads a summer day as starting at 22:00 UTC the day before`
  (`readPeriod({ from: '2026-07-14', to: '2026-07-14' })` gives `2026-07-13T22:00:00Z` and
  `2026-07-14T22:00:00Z`).
- Then, as a table: a winter day (23:00 UTC); the spring change day 2026-03-29 lasts 23 hours;
  the autumn change day 2026-10-25 lasts 25 hours; a whole year 2026; a period across the new
  year; `from > to` throws; `toParisDay` for 2026-12-31T23:30Z gives `2027-01-01`;
  `isCalendarDay` refuses `2026-02-30`, `2026-13-01`, `26-01-01`.
- CSV, first failing test: `guards a text value that starts with = so a spreadsheet does not run
it`. Then: the same for `+`, `-`, `@`, tab, carriage return; an amount of -1250 cents is
  written `-12.50` and not guarded; quoting of a comma, a quote (doubled), a line break; `null` is
  empty; header first; `\r\n` between rows; accents stay as they are; `formatEuros` for 0, 5, -5,
  100, 123456.

**Step 2. Record and list expenses, with the table.** Files: entity, expense contract, the
period parts of the accounting contract, mapper, `ExpensesService.record` and `list`,
`AdminExpensesController` (`POST`, `GET`), module, `app.module.ts`, the migration (section 5).

- First failing test, e2e: `an admin records an expense and finds it in the list for its period
(201 then 200)`.
- Then: a member and a distributor get 403 on both routes, no session 401; refuses an amount of
  0, a negative amount, a decimal amount, an unknown category, an unknown payment method, an empty
  label, a 201-character label, a day that does not exist; the list leaves out an expense dated
  the day before `from` and the day after `to`, and keeps those dated `from` and `to`; `from`
  after `to` is 400; the list is newest day first.
- The migration is read, cleaned and its worklog entry written in this step.

**Step 3. Cancel an expense, and the closed doors.** Service `cancel`, route `POST
admin/expenses/:expenseId/cancel`.

- First failing test, e2e: `cancelling an expense writes a reversing row that names it and
carries the reason`.
- Then: the answer shows the expense with `isCancelled` true; the list shows both rows, the
  cancellation dated today (Paris); refuses an empty reason (400); 404 on an unknown id; a member
  gets 403; the closed doors of section 6, one test each.
- The unique index is proven by one more test in the same e2e file: it inserts a cancellation
  row by hand through the entity manager, then calls the cancel route, and gets
  `already_cancelled` with still one cancellation row. No separate service spec.

**Step 4. The P&L.** `accounting.queries.ts`, `ProfitAndLossService`, route `GET
admin/accounting/profit-and-loss`, `tests/accounting-test-data.ts`.

`accounting-test-data.ts` inserts, through the entity manager, at a time the test chooses: a
handover with lines and their stock movements (and its reversal), a reception with lines and
movements, a fee payment and an adjustment, wallet rows of every reason, expenses and
cancellations. It sets `createdAt` (or `paidAt`, `receivedAt`, `spentOn`) by hand, so rows can sit
1 ms inside or outside a bound.

- First failing test, e2e: `counts a sale just inside both bounds and leaves out one just
outside` (period 2026-03-01 to 2026-03-31; handovers at 2026-02-28T22:59:59.999Z (outside),
  2026-02-28T23:00:00Z (inside), 2026-03-31T21:59:59.999Z (inside), 2026-03-31T22:00:00Z
  (outside)).
- Then: a handover reversal in the period lowers sales and cost of goods sold by the same amounts
  as the handover; cost of goods sold for a sale by weight (`1.333 kg` at `250` cents is `333`,
  rounded per row); a reception in the period changes no figure; fees count payments and
  adjustments by `paidAt`; expenses by category with a cancellation netting one to 0, all six
  categories present; result and gross margin; `pnl-ignores-wallet` — a top-up, a payment
  received, a payment correction and a refund in the period change no figure; an empty period
  gives all zeros; member and distributor 403; `from` after `to` 400.
- One test through the real code path: imports `DistributionModule` as well, records an express
  sale and reverses it through the distribution routes, then the P&L for today shows sales 0 and
  cost of goods sold 0 with both handovers counted. It proves the P&L reads what distribution
  really writes, not only what the test helpers write.

**Step 5. The five exports.** `ExportsService`, route `GET
admin/accounting/exports/:exportName`.

Columns, in this order:

- `wallet-movements`: `date, recordedAt, entryId, membershipNumber, memberName, reason,
paymentMethod, amountEur, handoverId, note`. One row per wallet entry in the period.
- `sales`: `date, recordedAt, handoverId, kind, reversesHandoverId, membershipNumber, memberName,
product, quantity, unitPriceEur, lineTotalEur, costOfGoodsEur`. One row per handover line.
  `costOfGoodsEur` is the line's stock movement cost, `0.00` when the line was declined and moved
  no stock.
- `purchases`: `date, recordedAt, receptionId, supplierOrderId, supplier, product,
receivedQuantity, unitCostEur, lineTotalEur`. One row per reception line; `lineTotalEur` is
  `round(quantity × unit cost)`.
- `membership-fees`: `date, recordedAt, paymentId, membershipNumber, memberName, kind, method,
amountEur, note`. One row per fee payment or adjustment, by `paidAt`.
- `expenses`: `date, expenseId, kind, cancelsExpenseId, category, label, paymentMethod,
amountEur, reason, recordedBy, recordedAt`. One row per expense or cancellation.

Rows are in time order (date, then `recordedAt`, then id, so the order is stable).

- First failing test, e2e: `the sales export returns a CSV with its header and one row per
handover line in the period`.
- Then: status 200, content type `text/csv; charset=utf-8`, file name
  `grocery-sales-2026-03-01-2026-03-31.csv`; each of the five has its header and the right row
  count, with a row just outside each bound left out; totals match the P&L for the same period:
  the sum of `lineTotalEur` is sales, of `costOfGoodsEur` is cost of goods sold, of the fee
  `amountEur` is fees, of the expense `amountEur` is the expense total (and per category);
  `wallet-movements` and `purchases` have no P&L figure, so their total is checked against the
  rows the test inserted; a member named `=SUM(A1)` comes out as `'=SUM(A1)`; a label with a comma
  and a quote comes out quoted; an unknown export name is 400; member and distributor 403.

**Step 6. Regenerate the client, the expenses screen, its browser test.**

- First failing test, Playwright: `accounting.spec.ts` — `l'admin enregistre une dépense et la
voit dans la liste` (red until the screen exists).
- Run `pnpm generate` against a throwaway API on another port (the project note on OpenAPI
  generation). Commit the generated client in its own commit.
- Then: `l'admin annule une dépense avec un motif, elle est marquée annulée`.

**Step 7. The P&L and exports screen, its browser tests.**

- First failing test, Playwright: `l'admin lit le compte de résultat de l'année et la dépense
apparaît dans sa catégorie`.
- Then: `l'admin télécharge l'export des dépenses` (Playwright `waitForEvent('download')`, reads
  the file, checks the header and the row of the expense just recorded); `un adhérent et un
distributeur n'atteignent pas les écrans de comptabilité` (two contexts, the existing role
  storage states).
- `nav-smoke.spec.ts` gets the two new routes added to its list. That is an addition for new
  routes, as lot 6 did, not a change to make a test pass.

**Step 8. Documentation, glossary, index, gates, close.** Section 10.

### 8. Frontend

New folder `apps/web-spa/app/features/admin-accounting/` with `components/` and `utils/`, built
like `admin-participation`. One export per component file, kebab-case names, no hard-coded text
(keys in both `lib/i18n/locales/en/common.locales.en.json` and `.../fr/common.locales.fr.json`
under `adminAccounting`), Lucide icons only, components from `@grocery/ui`, a test id on every
control a browser test uses.

- `utils/admin-accounting-queries.ts`: query options for the expense list and the P&L, the record
  and cancel calls, `downloadExport(exportName, period)`, and `invalidateAccounting(queryClient)`
  (one key prefix `admin-accounting`, so recording or cancelling an expense refreshes the list and
  the P&L). Built on the generated functions with `unwrap`, like `admin-participation-queries.ts`.
- `downloadExport` calls the generated export function, takes the text, wraps it in a `Blob`
  (`text/csv;charset=utf-8`), and clicks a temporary link with the file name
  `grocery-<export>-<from>-<to>.csv`, then revokes the object URL.
- `utils/use-period.ts`: the period lives in the page's search params (`?from=&to=`), so a reload
  or a shared link keeps it. Default: 1 January to 31 December of the current year in the browser
  (spec: "opens on the current calendar year").
- `components/period-picker.tsx`: two `type="date"` inputs, a "This year" button. The "to" input
  has `min` = from. Test ids `period-from`, `period-to`.

Routes in `routes.ts`, back office layout:

- `admin/accounting` → `profit-and-loss-page.tsx` (test id `page-profit-and-loss`). The period
  picker; the P&L as a short table (sales, cost of goods sold, gross margin, membership fees, each
  expense category, total expenses, result), negative figures shown with a minus sign; a block
  "Exports" with five buttons (test ids `export-<name>`); a link to the expenses page.
- `admin/accounting/expenses` → `expenses-page.tsx` (test id `page-expenses`). The period picker;
  a table (day, category, label, payment method, amount, recorded by, a "Cancelled" badge on a
  cancelled expense, the reason on a cancellation row); a "Record an expense" button; a "Cancel"
  button on each expense row that is neither cancelled nor a cancellation.
- Nav entry "Accounting" in `back-office-layout.tsx`, icon `Calculator`, `to: '/admin/accounting'`,
  test id `back-office-nav-accounting` (the `item.to.split('/').pop()` rule). It stays active on
  the expenses page (`startsWith`).

Dialogs:

- `record-expense-dialog.tsx`: date (default today), amount in euros, category, label, payment
  method. Five fields: react-hook-form with a Zod resolver, as `frontend.mdx` asks. The amount
  is converted to cents on submit with the helper the wallet forms already use.
- `cancel-expense-dialog.tsx`: one field, the reason, with `useState`, like the wallet dialogs
  (`AGENTS.md`, "Forms"). It says the cancellation cannot be undone.
- A refusal from the server is a toast with one sentence per code (`already_cancelled`,
  `cannot_cancel_cancellation`), like the refund dialog.

E2E seeder (`e2e.seeder.ts`): two expenses dated today — rent 450.00 € by transfer, bank fees
3.50 € by card. No cancellation. With the fee payment already seeded today (10.00 €), the browser
tests have known figures for the current year, and they assert changes, not absolute results.

### 9. Browser tests

Added in a new file `apps/web-spa-e2e/tests/accounting.spec.ts`, never editing an existing test
(the rule in `.agents/project.md`, §F). One addition to an existing file, said out loud:
`nav-smoke.spec.ts` gets the two new routes in its list. Before `pnpm e2e`, `docker ps` for ports
5434, 1093 and 1043 (another project's container is reported, never stopped).

### 10. Documentation and close

- New page `apps/documentation/src/content/docs/project/lot-7-accounting.mdx`, written like
  `lot-6-participation.mdx`: what the lot gives, the rules (what counts in each figure, by which
  date, the period in Paris time, cancellation not deletion, CSV format and the formula guard,
  products sold before any reception cost 0), "Not in lot 7", "Where the code is". The
  description is quoted if it holds a colon, and the documentation build runs because the page
  is new.
- `apps/documentation/src/content/docs/project/glossary.mdx`: an "Accounting" section with
  association expense, cancellation (of an expense), cost of goods sold, profit-and-loss account,
  period.
- `apps/documentation/src/content/docs/project/architecture-plan.mdx`: lot 7 marked as built, the
  same way the earlier lots are.
- `pnpm --filter @grocery/documentation generate:index` for `INDEX.md`.
- Gates, in this order, the long ones in the background with a full log file: `pnpm lint`,
  `pnpm typecheck`, `pnpm test`, `pnpm build`, then `docker ps`, then `pnpm e2e`. Never `pnpm fmt`
  repo-wide: `oxfmt` per folder, checked with `pnpm fmt:check`. A flaky wallet or distribution test
  is rerun once and said so.
- Commits: one per green step, explicit paths, scopes `api`, `frontend`, `tooling` (types and
  scopes from `commitlint.config.ts`), gitmoji after the colon, no `Co-Authored-By`, no push.

### 11. Edge cases handled, in one list

- A handover just before midnight Paris time whose stock movement is written just after: both
  count on the handover's day (section 2).
- A sale by weight whose cost has fractions of a cent: rounded per row, half away from zero; the
  reversal rounds to the exact opposite.
- A declined line (quantity 0): a sales row of 0, no stock movement, cost 0.
- A product sold before any reception: cost 0 (lot 4 behaviour), said in the documentation.
- A handover reversed in a later period: the sale counts in its period, the reversal in the later
  one.
- An expense cancelled in a later period: the expense counts in its period, the cancellation on
  the day it was cancelled (pending the ruling).
- Two admins cancel the same expense at once: the unique index lets one win; the other gets
  `already_cancelled`.
- The spring and autumn clock changes: the day is 23 or 25 hours long, both bounds are still Paris
  midnight.
- `from` equal to `to`: one day. `from` after `to`: 400.
- A text cell starting with `-` (a label like "- 10 % discount"): guarded. An amount of `-12.50`:
  not guarded, it is a number.
- A member name or label with a comma, a quote or a line break: quoted, quotes doubled.

## Questions for the Architect

1. **Which time puts a sale's cost in the period.** The spec's Implementation Decisions say a
   stock movement belongs to the period by its own creation time; the criterion
   `pnl-cost-of-goods` says "stock movements written by handovers in that period". The handover,
   its lines and its stock movements get times a few milliseconds apart. Filtering each on its own
   time can split one sale across two periods near midnight, and the sales export would no longer
   match the P&L. Options: (a) use the handover's time for its lines and their stock movements;
   (b) use each row's own time, as the Implementation Decisions line reads. **Recommendation: (a).**
   It changes the wording of a 🧑 line, so it may need the human.
2. **The date of a cancellation row.** Options: (a) the day it was cancelled, so a past P&L never
   changes and it behaves like a handover reversal; (b) the date of the expense it cancels, so the
   mistake disappears from its own period. **Recommendation: (a).**
3. **The formula guard covers tab and carriage return too**, beside the spec's `=`, `+`, `-`,
   `@`, following the OWASP guidance on CSV injection. Fine to add?
4. **Two exports have no P&L figure to match.** The criterion `five-csv-exports` says the totals
   match the P&L; wallet movements and purchases are not on the P&L by design. Their totals are
   tested against the rows the test wrote instead. Fine?

## Corrections at the reading

Written and signed by the Architect, 2026-11-24.

1. **Which time puts a sale's cost in the period: (a), the handover's time** for its lines and
   their stock movements. The spec line that said "the stock movement's creation time" was the
   Architect's own wording, not a human decision; it is corrected in the spec to match the
   criterion `pnl-cost-of-goods`.
2. **The date of a cancellation row: (a), the day it was cancelled**, in Paris time. A P&L given
   for a past period never changes afterwards.
3. **The formula guard also covers a tab and a carriage return.** It is a wider guard than the
   spec's four characters, so it still meets `csv-safe-for-spreadsheets`.
4. **Wallet movements and purchases are checked against the rows the test wrote.** The criterion
   `five-csv-exports` is amended in the spec (struck, with a dated replacement).

No other change. Go ahead with step 1.

## Worklog

- 2026-11-24 — Mason. Read the reading list, the spec, the lot 6 work document, the wallet,
  distribution, inventory, purchasing and members modules, `@lonestone/nzoth`'s route decorator,
  the generated client configuration and the SPA back office. Verified that every sale goes
  through a handover (section 1). Wrote this plan. No code yet.

## Implementation Checkboxes

- [ ] Step 1 — period reader and CSV writer, test first
- [ ] Step 2 — record and list expenses, entity, migration (cleaned, worklog entry)
- [ ] Step 3 — cancel an expense, closed doors of the final state
- [ ] Step 4 — the P&L route, bounds, reversal, wallet ignored, real distribution path
- [ ] Step 5 — the five CSV exports, totals match the P&L
- [ ] Step 6 — regenerated client, expenses screen, browser tests
- [ ] Step 7 — P&L and exports screen, browser tests, nav-smoke routes
- [ ] Step 8 — documentation page, glossary, architecture plan, index, documentation build
- [ ] Gates — `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm e2e`
- [ ] Review — `code-review` on the full diff since `origin/staging`, findings answered
- [ ] Close — criteria ticked, journal, archive, retro, status `done`

## Notes & Snippets

- `TypedRoute.Get(path)` with no schema applies a plain NestJS `@Get` and no response check
  (`typed-route.decorator.js` in `@lonestone/nzoth` 1.2.0), so a `StreamableFile` answer passes
  through.
- The generated client is `@hey-api/client-fetch`: it reads a `text/*` answer as text.
- `membershipPayment.paidAt` is an instant: the SPA sends `new Date().toISOString()`.
- No handover is seeded in the E2E data; one fee payment of 10.00 € is, dated at seeding time.

## Diff-Review Findings
