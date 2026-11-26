# Send supplier orders automatically, on each supplier's rhythm — work

Created by the Mason at the plan step, 2026-11-26. Spec:
`project-management/tasks/20261126-1505-automatic-supplier-orders.spec.md`.

**Plan:** approved by the Architect on 2026-11-26, with the three rulings under "Rulings at the reading".

## Program Design

Read for this plan: the spec; the reading list of §C · Reading list of `.agents/project.md`
(README, documentation index, general, backend and frontend guidelines, constitution,
`CONTRIBUTING.md`, `.cursor/rules/5_migrations.mdc`, the latest journal entries); and the code
of `purchasing`, `catalog` (supplier, referent), `email`, `wallet/member-notice.service.ts`,
`common/csv.util.ts`, `accounting/period.util.ts`, the test helpers, the e2e seeder and maildev
helper, and the SPA's `catalog/components/suppliers-tab.tsx` and
`admin-purchasing/components/supplier-order-detail-page.tsx`.

### What the code says today (facts the plan builds on)

- `PurchasingService.send` only flips `draft → sent` with the optimistic `version`; nothing
  leaves the app. The route is `POST /admin/purchasing/supplier-orders/:id/send`.
- The CSV staff download today is `PurchasingMapper.toExport(order)`: `toCsvLines(…, {
alwaysQuote: true })` joined with `\n`, filename `supplier-order-<name>-<YYYY-MM-DD>.csv`,
  served as JSON `{ filename, content }` and saved by the SPA with `downloadFile`. The
  attachment reuses this method as is, so it is byte for byte the download.
- `EmailService.sendEmail({ to, subject, content, html })` knows no copy and no attachment.
- `MemberNoticeService` (wallet) holds a private "every admin's real address" lookup:
  users not banned, role contains `admin`, phone-only synthetic addresses skipped.
- `Supplier.contactEmail` exists in the entity and the contract, `Referent.contactEmail` too.
  **The SPA's supplier dialog edits only the name and the type**: no screen sets a supplier's
  address or its referent today. See the questions at the end.
- `@nestjs/schedule` 6.1.3 is installed and unused. Its `@Cron` takes `waitForCompletion` and
  `disabled`. MikroORM is 7.1; `LockMode.PESSIMISTIC_PARTIAL_WRITE` is `FOR UPDATE SKIP
LOCKED`; `@EnsureRequestContext()` comes from `@mikro-orm/decorators/legacy`.
- The API test apps (`initializeTestApp`) import feature modules one by one and never
  `ScheduleModule`, so a `@Cron` method there is inert. Tests build the schema from the
  entities, not from migrations.

### Shared Paris time

The spec allows moving `COOPERATIVE_TIME_ZONE` when two modules need it. Three will (accounting,
catalog, purchasing), so:

- New `apps/api/src/common/paris-time.util.ts` takes `COOPERATIVE_TIME_ZONE`, `isCalendarDay`,
  `toParisDay`, `startOfParisDay` and the private `readParisParts` out of
  `accounting/period.util.ts`, unchanged. `period.util.ts` imports them back and keeps
  `readPeriod`; its existing spec stays green as the proof nothing moved in meaning.
- It gains one function:

```ts
/** The instant the Paris clock reads `hour`:00 on `day`. In the spring gap (02:00 does not
 *  exist) it returns 03:00; in the autumn overlap (02:00 happens twice) the first one. */
export function parisInstantAt(day: string, hour: number): Date
```

Same method as `startOfParisDay`: try the UTC candidates for offsets +2 then +1, keep the
first one that reads back `day` and `hour`; if none does (spring gap), return
`parisInstantAt(day, hour + 1)`.

### Seam: the schedule rule (pure)

New `apps/api/src/modules/catalog/order-schedule.util.ts`. Days are `YYYY-MM-DD` strings,
weekdays are ISO numbers (1 Monday … 7 Sunday). Day arithmetic is done on UTC dates of the
calendar day, never on instants; only the final instants go through `paris-time.util.ts`.

```ts
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7
export type WeekParity = 'every' | 'even' | 'odd'
export type MonthWeek = 'first' | 'second' | 'third' | 'fourth' | 'last'

export type DistributionRule =
  | { frequency: 'weekly'; weekday: IsoWeekday; parity: WeekParity }
  | { frequency: 'monthly'; weekday: IsoWeekday; monthWeek: MonthWeek }

export interface OrderScheduleRule {
  distribution: DistributionRule
  sendingWeekday: IsoWeekday
  sendingHour: number // 0–23, whole hours
}

export interface ScheduledDistribution {
  distributionDay: string // YYYY-MM-DD, Paris calendar day
  startsAt: Date // 00:00 Paris on that day ("the distribution has started")
  sendingAt: Date // sendingHour:00 Paris on the sending day
}

export function isoWeekNumber(day: string): number
export function isDistributionDay(rule: DistributionRule, day: string): boolean
/** The last `sendingWeekday` strictly before the distribution day (1 to 7 days before). */
export function sendingDayFor(sendingWeekday: IsoWeekday, distributionDay: string): string
/** The first distribution whose day starts after `now`. */
export function nextDistribution(rule: OrderScheduleRule, now: Date): ScheduledDistribution
/** The last distribution whose day has started at `now`, or null if none in the past year. */
export function latestStartedDistribution(
  rule: OrderScheduleRule,
  now: Date,
): ScheduledDistribution | null
/** The distribution just before a given distribution day. */
export function previousDistribution(
  rule: OrderScheduleRule,
  distributionDay: string,
): ScheduledDistribution
/** Reads the rule off the supplier's columns; null when the schedule is incomplete. */
export function readOrderScheduleRule(columns: SupplierScheduleColumns): OrderScheduleRule | null
```

`next…`/`previous…`/`latest…` walk day by day from the Paris day of `now` (at most 400 days)
and test `isDistributionDay`. That is a few hundred cheap checks, and it makes the ISO week 53
case and the "first Friday is the 1st" case fall out with no special code. "The last weekday
of the month" is: that weekday, and the same day plus 7 is in the next month.

### Seam: when is a distribution due (pure)

Also in `order-schedule.util.ts`, used only by the automatic run:

```ts
export interface DueDistributions {
  /** Started, never handled, sending moment after the schedule was switched on → alert. */
  missed: ScheduledDistribution | null
  /** Sending moment reached, not started yet, never handled → send now. */
  due: ScheduledDistribution | null
}
export function findDueDistributions(input: {
  rule: OrderScheduleRule
  now: Date
  handledDay: string | null // supplier.scheduleHandledDay
  activeSince: Date // supplier.scheduleActiveSince
}): DueDistributions
```

- `due` = `nextDistribution(rule, now)` when `now >= sendingAt`, `sendingAt >= activeSince`, and
  `handledDay` is null or before its day.
- `missed` = `latestStartedDistribution(rule, now)` when `sendingAt >= activeSince` and
  `handledDay` is null or before its day. Only the latest one is reported: an API down for a
  month raises one alert, not four.
- Day strings compare as strings (`'2026-12-04' > '2026-11-27'`).

### Data model and migration

On `Supplier` (catalog), all nullable except the flag; names in the entity, quoted camelCase
columns as the rest of the schema:

| Property                      | Column type                 | Meaning                                                  |
| ----------------------------- | --------------------------- | -------------------------------------------------------- |
| `scheduleEnabled`             | boolean, default false      | the schedule is on                                       |
| `scheduleFrequency`           | text                        | `weekly` or `monthly`                                    |
| `scheduleWeekParity`          | text                        | `every`, `even`, `odd` (weekly only)                     |
| `scheduleMonthWeek`           | text                        | `first` … `fourth`, `last` (monthly only)                |
| `scheduleDistributionWeekday` | smallint                    | ISO weekday of the distribution                          |
| `scheduleSendingWeekday`      | smallint                    | ISO weekday of the sending                               |
| `scheduleSendingHour`         | smallint                    | 0–23                                                     |
| `scheduleActiveSince`         | timestamptz                 | set when the schedule is switched on or its rule changes |
| `scheduleHandledDay`          | date (string in the entity) | the last distribution day the run handled                |

On `SupplierOrder` (purchasing), written once at sending:

| Property   | Column type | Meaning                                                           |
| ---------- | ----------- | ----------------------------------------------------------------- |
| `sentMode` | text        | `manual` or `automatic`; null for orders sent before this task    |
| `sentTo`   | text        | the supplier address the e-mail went to; null when no e-mail left |

Enums (`scheduleFrequency`, `weekParity`, `monthWeek`, `sentMode`) live in the contracts, typed
on the entity with `import type`, as `status` already is.

**One migration**, generated in step 2 once both entities carry their columns, with
`pnpm --filter=api db:migrate:create` on the disposable E2E database (never `.env`, port 5111 is
another project's). The Typist reads the SQL first, removes the eight `*_search_idx` drop and
create lines and anything else not in the two tables above, and writes in the worklog what it
removed. No data back-fill: old sent orders keep `sentMode` null and the SPA shows "sent" with
no detail for them.

### Contracts

`catalog/contracts/supplier.contract.ts`:

```ts
export const supplierOrderScheduleSchema = z.object({
  enabled: z.boolean(),
  frequency: scheduleFrequencySchema.nullish(),
  weekParity: weekParitySchema.nullish(),
  monthWeek: monthWeekSchema.nullish(),
  distributionWeekday: isoWeekdaySchema.nullish(),  // z.number().int().min(1).max(7)
  sendingWeekday: isoWeekdaySchema.nullish(),
  sendingHour: z.number().int().min(0).max(23).nullish(),
}).superRefine(requireCompleteWhenEnabled).meta({ title: 'SupplierOrderSchedule', … })

export const supplierNextOrderSchema = z.object({
  distributionDay: z.string(),   // YYYY-MM-DD, Paris
  sendingAt: z.date(),
}).meta({ title: 'SupplierNextOrder', … })
```

- Read (`supplierSchema`): `orderSchedule: supplierOrderScheduleSchema` (always present,
  `enabled: false` with nulls by default) and `nextOrder: supplierNextOrderSchema.nullish()`
  (null when the schedule is off or incomplete).
- Write (`createSupplierSchema`, hence `updateSupplierSchema`): `orderSchedule` nullish.
  `requireCompleteWhenEnabled` refuses, with a Zod issue on the missing path, an enabled schedule
  missing the frequency, the distribution weekday, the sending weekday, the hour, or the
  parity (weekly) / month week (monthly). Zod refusals answer 400, as every other contract.
  A disabled schedule may be partial, so an admin can switch it off and keep the values.

`purchasing/contracts/supplier-order.contract.ts`: `supplierOrderSentModeSchema` (`manual`,
`automatic`) and two fields on `supplierOrderSchema`: `sentMode` nullish, `sentTo` nullish.

### Supplier service and mapper (catalog)

- `CatalogService.createSupplier` / `updateSupplier` take `orderSchedule` out of the input and
  write it through one private `applyOrderSchedule(supplier, input, now)`: copy the seven
  fields; set `scheduleActiveSince = now` when the schedule goes from off to on, or when it is
  on and any rule field changed. `scheduleHandledDay` is never written here.
- `CatalogMapper.toSupplier(supplier, productCount, now = new Date())` fills `orderSchedule`
  and `nextOrder` (`readOrderScheduleRule` then `nextDistribution`). `nextOrder` is the next
  distribution and its own sending moment. Between that sending moment and the distribution
  day the sending moment shown is in the past; that is the truth, and the SPA shows it as is.
- Why `scheduleActiveSince`: without it, switching a schedule on after this week's sending
  moment but before the distribution would make the next tick send at once (a "late catch-up"
  for a moment the admin never chose), or raise a "missed" alert. With it, a moment before the
  switch-on is ignored.

### Seam: the e-mail service (email module)

`EmailOptions` gains two optional fields, passed to nodemailer as they are:

```ts
export interface EmailAttachment {
  filename: string
  content: string
  contentType: string
}
export interface EmailOptions {
  to: string
  cc?: string[]
  subject: string
  content: string
  html?: string
  attachments?: EmailAttachment[]
}
```

`cc` and `attachments` are only put into `mailOptions` when present, so the two existing
`email.service.spec.ts` cases (which assert the exact object) stay green unchanged.

### Admin addresses, shared

New `apps/api/src/modules/members/admin-addresses.ts`:

```ts
/** The real address of every admin who is not banned. Phone-only accounts are skipped. */
export async function findAdminAddresses(em: EntityManager): Promise<string[]>
/** A user's address, or null for the synthetic address of a phone-only account. */
export function realAddress(user: User): string | null
```

`MemberNoticeService` uses them instead of its private copies (same behaviour; its spec is the
proof). `SupplierOrderMailService` uses `realAddress` for the referent's account.

### Seam: the order e-mail (purchasing)

New `apps/api/src/modules/purchasing/supplier-order-mail.service.ts`, the only place that knows
the e-mail's content:

```ts
export type OrderMailResult = { sentTo: string } | { sentTo: null; reason: 'no_address' }

@Injectable()
export class SupplierOrderMailService {
  constructor(email: EmailService, mapper: PurchasingMapper) {}
  /** Needs `supplier`, `supplier.referent`, `supplier.referent.user`, `lines`, `lines.product`
   *  loaded. Resolves `{ sentTo: null }` when the supplier has no address; throws
   *  `OrderMailError` when the mail server refuses. */
  sendOrder(order: SupplierOrder): Promise<OrderMailResult>
}
export class OrderMailError extends Error {}
```

- To: `supplier.contactEmail`. Cc: the referent's `contactEmail`, else the real address of the
  referent's account, else no copy.
- Subject: `Commande de la coopérative Grocery — <supplier name>`. Body (text and HTML, HTML
  escaped): a greeting, one line per product `<name> : <quantity> <kg|pièce(s)>`, the line
  count, the order date in Paris, "Le détail est aussi dans le fichier CSV joint." Wording is
  French; the Typist drafts it and the review reads it.
- Attachment: `mapper.toExport(order)` → `{ filename, content, contentType: 'text/csv' }`.

### Seam: admin notices (purchasing)

New `apps/api/src/modules/purchasing/supplier-order-notice.service.ts`, the wallet notice
pattern: every method catches everything, logs with the supplier and the order, never rejects.

```ts
notifyAutoSent(input: { supplierName: string; distributionDay: string; lineCount: number; orderCount: number }): Promise<void>
notifySendFailed(input: { supplierName: string; orderId: string; mode: SupplierOrderSentMode; reason: 'no_address' | 'mail_error' }): Promise<void>
notifyMissedDistribution(input: { supplierName: string; distributionDay: string }): Promise<void>
```

Each sends one e-mail to each address from `findAdminAddresses`. The order is named by its
supplier, its creation date and its id, with the back-office path
`/admin/purchasing/supplier-orders/<id>` written out in the text (no absolute URL: the API
knows `CLIENTS_WEB_APP_URL` from the env config; the Typist uses it if it is there, else the
path only).

### Seam: the manual send (route unchanged)

`PurchasingService.send(id, version)` becomes:

```
transaction:
  order = findOne(SupplierOrder, id, lock PESSIMISTIC_WRITE)       // 404 if none
  checkTransition(order, 'draft', version)                           // 409 as today
  populate supplier, supplier.referent.user, lines.product
  try   result = await orderMail.sendOrder(order)
  catch OrderMailError → mark failure (after the transaction): notice.notifySendFailed(mode manual, mail_error)
                        throw 502 { statusCode: 502, code: 'order_mail_failed', message }
  markSent(order, 'manual', result.sentTo)                          // status, sentAt, sentMode, sentTo
```

- The row lock replaces the optimistic-only check for the length of the send: two staff
  pressing "Send" at once, or a staff member and the automatic run, cannot both mail the
  supplier. The version check stays, so a stale screen still gets 409.
- No address: `sentTo` null, order sent, as today. The response is the detail, which now
  carries `sentMode` and `sentTo`; the SPA reads `sentTo: null` to say no e-mail left.
- Mail error: nothing is written, the order stays a draft, the alert goes to every admin, and
  the route answers 502 with the code `order_mail_failed`. The alert is sent after the
  transaction rolled back, never inside it.
- `markSent(order, mode, sentTo)` is one private helper used by the manual send and the run.

### Seam: the automatic run (purchasing)

New `apps/api/src/modules/purchasing/supplier-order-schedule.service.ts`:

```ts
export interface ScheduleRunOutcome {
  supplierId: string
  result: 'not_due' | 'locked_elsewhere' | 'already_sent' | 'nothing_to_order'
        | 'sent' | 'partly_failed' | 'missed'
  distributionDay?: string
}

@Injectable()
export class SupplierOrderScheduleService {
  constructor(em: EntityManager, purchasing: PurchasingService,
              orderMail: SupplierOrderMailService, notices: SupplierOrderNoticeService) {}

  /** One pass over every supplier whose schedule is on. Never rejects: a supplier that
   *  throws is logged and the pass goes on. */
  @EnsureRequestContext()
  runDue(now: Date): Promise<ScheduleRunOutcome[]>
}
```

Per supplier (ids loaded first: `scheduleEnabled: true, archivedAt: null`), in its own
`em.transactional`:

1. Lock the supplier row with `PESSIMISTIC_PARTIAL_WRITE` (`FOR UPDATE SKIP LOCKED`). No row →
   another process holds it → `locked_elsewhere`. Re-check enabled, not archived, rule complete.
2. `findDueDistributions`. Nothing → `not_due`.
3. For `missed` and then `due`, write `scheduleHandledDay = distributionDay` **first**, whatever
   happens next: a handled distribution is never tried again (the spec forbids retries).
4. "Already sent" check (see the question below for the window): an order of this supplier
   with `sentAt >= window start` → `already_sent`, nothing mailed, no summary.
5. `missed` → record an alert to send after commit → `missed`.
6. `due` → gather: `purchasing.collectPendingLines(em, supplier)` and, when anything is
   orderable, `purchasing.createDraft(em, supplier, lines)` (see "Aggregation, extracted").
   Then load every `draft` of the supplier, oldest first, each locked `PESSIMISTIC_WRITE`,
   populated for the e-mail. None → `nothing_to_order`.
7. For each draft, its own e-mail: `sendOrder`. `{ sentTo }` → `markSent(order, 'automatic',
sentTo)`. `{ sentTo: null }` (no address) or `OrderMailError` → stays draft, alert recorded
   with its reason. Result `sent` or `partly_failed`.
8. Commit. **After** the commit: the summary (`notifyAutoSent`, total lines of the orders that
   left, only if at least one did), then each recorded alert. If the commit fails, no summary
   claims a send that rolled back.

Each draft is its own e-mail, as the spec decided; the plan does **not** merge drafts, because
merging would rewrite `SupplierOrderLine` rows that lot 3 treats as fixed per order.

Known limit, written in the docs page: if the process dies after an e-mail left and before
the commit, the order is still a draft and the distribution is not marked handled, so the next
tick mails the supplier a second time. Making that impossible needs an outbox; the spec does
not ask for it.

### Aggregation, extracted (no change in behaviour)

`PurchasingService.aggregate` is split, with the same rules and the same 409:

```ts
collectPendingLines(em, supplier): Promise<{ orderable: OrderLine[]; skippedLines: SkippedLine[] }>
createDraft(em, supplier, orderable): SupplierOrder   // persists order and lines, links them
aggregate(supplierId)  // transactional: collect, 409 if nothing orderable, createDraft, flush
```

The lot 3 aggregation tests in `purchasing.controller.e2e-spec.ts` stay unchanged and green.

### Seam: the job and the clock

- `AppModule` imports `ScheduleModule.forRoot()`. Nothing else in the app uses it.
- New `apps/api/src/modules/purchasing/supplier-order-schedule.job.ts`:

```ts
@Injectable()
export class SupplierOrderScheduleJob {
  constructor(run: SupplierOrderScheduleService) {}
  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: 'supplier-order-schedule', waitForCompletion: true, disabled: config.e2e,
  })
  async tick(): Promise<void>   // runDue(new Date()), catches and logs anything
}
```

- Every 5 minutes: an e-mail leaves at most 5 minutes after its hour, and the admin summary
  says when. `waitForCompletion` stops a slow pass from overlapping the next tick in one
  process; the row lock covers two processes.
- **Off the clock in tests.** The service tests call `runDue(instant)` directly and never wait.
  The API test apps never import `ScheduleModule`, so the `@Cron` there is inert. The browser
  suite runs the full `AppModule` with `E2E=true`, so the job is `disabled` there: the browser
  tests stay deterministic and never mail a supplier on the wall clock.
- `PurchasingModule` imports `EmailModule` and provides `SupplierOrderMailService`,
  `SupplierOrderNoticeService`, `SupplierOrderScheduleService`, `SupplierOrderScheduleJob`.

### The SPA

- **Supplier dialog** (`catalog/components/suppliers-tab.tsx`): it gains the contact e-mail
  (see the question) and moves to react-hook-form + Zod, as AGENTS.md asks once fields validate
  across each other. The schedule gets **its own dialog**, `supplier-schedule-dialog.tsx`,
  opened from a new row button "Envoi automatique", so the plain supplier dialog stays short:
  an on/off switch, "Chaque semaine / Chaque mois", the weekday, the parity (toutes les
  semaines, semaines paires, semaines impaires) or the month week (1er, 2e, 3e, 4e, dernier),
  the sending weekday and the hour (a select of whole hours). Its Zod schema mirrors
  `requireCompleteWhenEnabled`. It sends `PUT /admin/suppliers/:id` with `orderSchedule` and
  `version`.
- **Next dates**: a new column "Prochaine commande" in the suppliers table: "Distribution
  ven. 4 déc. · envoi mer. 2 déc. à 8 h", formatted with `timeZone: 'Europe/Paris'`; "—" when
  the schedule is off. The same line shows in the schedule dialog after a save.
- **Order detail** (`supplier-order-detail-page.tsx`): under the head, for a sent order with a
  `sentMode`: "Envoyée à la main" or "Envoyée automatiquement", then "à <address>" or "Aucun
  e-mail n'est parti (pas d'adresse fournisseur)". `testid="supplier-order-sent-how"`.
- **Send toasts**: success with `sentTo` → "Commande envoyée à <address>."; success with
  `sentTo: null` → "Commande marquée envoyée. Aucun e-mail n'est parti : le fournisseur n'a pas
  d'adresse."; 502 `order_mail_failed` → "L'e-mail n'est pas parti. La commande reste en
  brouillon et les admins sont prévenus."; 409 keeps today's message.
- i18n keys in `app/lib/i18n/locales/{fr,en}/common.locales.*.json`, one block under
  `catalog.suppliers.schedule` and one under `purchasing.send`.
- The generated client is refreshed with `pnpm generate` after each contract change.

### Browser fixtures

`seeders/e2e.fixtures.ts` gains `E2E_ORDER_MAIL`: a supplier with `contactEmail
commandes@fournisseur-mail.e2e.example`, a referent with `contactEmail
referent@fournisseur-mail.e2e.example`, one pre-orderable product with one pending pre-order,
and one order already sent `automatic` to that address. `e2e.seeder.ts` seeds it. The existing
`E2E_PURCHASING` supplier keeps no address, so the existing browser tests that press "Send"
take the "no e-mail" path and still pass untouched.

### Decisions the spec left to the plan

- Paris time helpers move to `common/paris-time.util.ts` (three modules use them).
- Schedule stored as typed columns on `supplier`, not JSON, so each field is readable in SQL.
- Hours are whole hours, 0 to 23. In the spring gap the e-mail leaves at 03:00; in the autumn
  overlap, at the first 02:00.
- `scheduleActiveSince` guards against sending or alerting for a moment before the schedule
  was switched on or changed.
- A distribution is marked handled before anything is tried, so no outcome is ever retried.
- Drafts are not merged; each draft is one e-mail.
- Manual send takes a row lock on the order; the run takes `SKIP LOCKED` on the supplier, then
  row locks on the drafts. Lock order is always supplier then order, so no deadlock.
- Manual send failure answers 502 with the code `order_mail_failed`.
- The admin notices go out after the commit.
- The job ticks every 5 minutes and is disabled under `E2E`.
- `nextOrder` is the next distribution and its own sending moment.
- Referent copy: `Referent.contactEmail`, else the referent's account address.

### Test order — the first failing test of each step

Each step starts by writing the named test file, running it, and writing the red log's name and
its error line in the worklog before any production file of the step (AGENTS.md, "Prove the red
at once").

| Step | First failing test                                                                                                     | What it shows red                                                                                                                                          |
| ---- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `apps/api/src/modules/catalog/tests/order-schedule.util.spec.ts`                                                       | flour example: from 2026-11-26 the next distribution is 2026-12-04 and the sending 2026-12-02 08:00 Paris (module missing)                                 |
| 2    | `apps/api/src/modules/catalog/tests/catalog.controller.e2e-spec.ts`, new `describe('supplier order schedule')`         | `PUT` with a monthly schedule then `GET` returns `orderSchedule` and `nextOrder`; an enabled schedule with no hour answers 400                             |
| 3    | `apps/web-spa-e2e/tests/supplier-order-schedule.spec.ts`                                                               | the admin sets "first Friday, sent the last Wednesday at 8 h" and the row shows the next dates                                                             |
| 4    | `apps/api/src/modules/email/email.service.spec.ts`, new case                                                           | `cc` and `attachments` reach `sendMail`                                                                                                                    |
| 5    | `apps/api/src/modules/purchasing/tests/supplier-order-notice.service.spec.ts`                                          | each admin gets one alert naming the supplier, the order and the reason; a rejected mail never rejects the notice                                          |
| 6    | `apps/api/src/modules/purchasing/tests/purchasing.controller.e2e-spec.ts`, new `describe('send e-mails the supplier')` | `send` calls the fake `sendEmail` with the supplier address, the referent in `cc`, the CSV attached, and the detail carries `sentMode: 'manual'`, `sentTo` |
| 7    | `apps/web-spa-e2e/tests/admin-purchasing-send-mail.spec.ts`                                                            | after "Send", maildev holds the mail with its CSV, and the detail reads "Envoyée à la main à …"; the seeded order reads "Envoyée automatiquement"          |
| 8    | `apps/api/src/modules/purchasing/tests/supplier-order-schedule.service.spec.ts`                                        | at the sending moment the run gathers and mails the order, marked `automatic`                                                                              |
| 9    | `apps/api/src/modules/purchasing/tests/supplier-order-schedule.job.spec.ts`                                            | `tick` calls `runDue` with a `Date` and resolves when `runDue` throws                                                                                      |

The full list of cases per step is in the checkboxes below.

## Worklog

- 2026-11-26, Mason: plan written from the spec and the code read above. No production code.
- 2026-11-26, Typist, step 3 green: `step3-green.log` (new spec 3 tests plus `catalog-suppliers.spec.ts` 4 tests: 8 pass on the E2E stack) and `step3-green-2.log` (`admin-purchasing-aggregate`, `back-office-desktop`, `catalog-products`: 56 pass). `pnpm typecheck` of web-spa and web-spa-e2e clean; oxlint clean. The new spec's dates are read from the wall clock, so it asserts the shape (first Friday day 1 to 7, sent on a Wednesday at 8 h), not fixed dates. The schedule dialog closes on save; it shows the next-dates line from the supplier when opened, and the row shows it at once. Both E2E servers I started were stopped (ports 3060 and 5273 free).
- 2026-11-26, Typist, step 3 red: first run `step3-red.log` (scratchpad): 3 tests fail. The two e-mail tests fail with `waiting for getByTestId('supplier-contact-email')`. The schedule test timed out in `beforeEach` on a cold start (`waiting for getByTestId('catalog-tab-suppliers')`), so I reran it alone with the servers already warm: `step3-red-1.log`, error line `Error: element(s) not found … waiting for getByTestId('supplier-row-Ferme des Prés').getByTestId('supplier-next-order')`. No production file touched before this. For the step I started the E2E API (`nest start`, pid in `api-e2e.pid`) and the SPA dev server (pid in `spa-e2e.pid`) by hand on ports 3060 and 5273 to avoid cold starts; I stop both at the end of my run.
- 2026-11-26, Typist, step 2 red: log `step2-red.log` (scratchpad), 12 cases fail in the new `describe('supplier order schedule')`, first error line `AssertionError: expected undefined to match object { enabled: false }` (no `orderSchedule` in the answer yet); the 400 cases fail with `expected 200 to be 400`.
- 2026-11-26, Typist, step 2 green: `step2-green.log` (catalog tests, 5 files, 87 pass) and `step2-api-all.log` (whole API suite, 42 files, 791 tests pass). `pnpm typecheck` at the root clean.
- 2026-11-26, Typist, step 2 migration: `Migration20261126142205.ts`. Generated on a scratch database `grocery_migrate_scratch` created inside the existing disposable E2E Postgres container `grocery-e2e-db` (port 5434; I did not start that container, it was already running; the scratch database is dropped). All earlier migrations were applied first. Generated SQL held, besides my two `alter table` lines, eight `drop index` lines (`category_name_search_idx`, `user_email_search_idx`, `user_name_search_idx`, `user_phoneNumber_search_idx`, `product_barcode_search_idx`, `product_description_search_idx`, `product_name_search_idx`, `member_membershipNumber_search_idx`) and the eight matching `CREATE INDEX` lines in `down`. I removed all sixteen. Up, down and up again ran clean; `schema:update --dump` afterwards showed only the search-index drops and `normalize_search`. MikroORM also wrote a `.snapshot-grocery_migrate_scratch.json` (named after the scratch database); I deleted it. The tracked `.snapshot-grocery.json` is stale already (no `expense` table), so I left it alone.
- 2026-11-26, Typist, step 2 generate: the API had to run with `NODE_ENV=development` (the OpenAPI route exists only there), on the E2E database, port 3060 (`E2E=false`, because `E2E=` empty fails the env check). I stopped it after (started with `nest start`, pid in `api-dev.pid`, port 3060 free again). The E2E database was rebuilt by `e2e:setup` so it carries the new columns. The generated client also picked up an older drift, `expensesByCategory` (the committed client was behind the accounting contract); not mine, kept because it is what `pnpm generate` outputs.
- 2026-11-26, Typist, plan clarification: the contract field `sentMode`/`sentTo` on `supplierOrderSchema` and the mapper are left to step 6 as the step 6 box says; step 2 only adds the entity columns and the `supplierOrderSentModeSchema` enum (the entity needs the type). Also: `PUT /admin/suppliers/:id` ignores a null `contactEmail` (existing `stripNullish`), so an address cannot be cleared from the form. The plan does not answer this; see the open questions at the end of the report. (Typist, 2026-11-26)
- 2026-11-26, Typist, step 1 green: `step1-green.log`, 3 files, 61 tests pass (order-schedule, paris-time, period). `pnpm typecheck` (api) and oxlint clean. Note: `oxfmt` is not on the PATH here; run it as `node_modules/.bin/oxfmt`.
- 2026-11-26, Typist, step 1 red: log `step1-red.log` (scratchpad), error line `Error: Cannot find module '../order-schedule.util' imported from …/catalog/tests/order-schedule.util.spec.ts` (and `./paris-time.util` for `common/paris-time.util.spec.ts`). Written before any production file.

## Implementation Checkboxes

- [x] **1. Paris time and the schedule rule** (pure, no database)
  - [x] red first: `order-schedule.util.spec.ts`, the flour example of `next-dates-shown`
  - [x] `common/paris-time.util.ts` (moved helpers + `parisInstantAt`); `period.util.ts` imports
        them (re-exported, so the accounting imports stay as they were); `period.util.spec.ts` green unchanged; new `common/paris-time.util.spec.ts` for
        `parisInstantAt` on the last Sundays of March and October 2026
  - [x] `order-schedule.util.ts` and its cases: weekly every week; even and odd weeks; ISO
        week 53 of 2026 followed by week 1 of 2027 (two odd weeks in a row, named in the test
        title); monthly 1st…4th and last over the twelve months of 2027; a month whose first
        Friday is the 1st (sending Wednesday in the month before: January 2027, Friday the 1st,
        sending Wednesday 30 December 2026); sending weekday equal to the distribution weekday
        (a week earlier); a sending at 02:00 on the spring and autumn change days
  - [x] `findDueDistributions`: before the moment, at the moment, after handled, late before the
        distribution, after the distribution started, moment before `activeSince`
  - [x] commit
- [x] **2. The schedule on the supplier, in the API**
  - [x] red first: the new `describe` in `catalog.controller.e2e-spec.ts`
  - [x] entity columns on `Supplier` and on `SupplierOrder` (`sentMode`, `sentTo`)
  - [x] one migration on the disposable E2E database; SQL read; search-index lines and anything
        else outside the two tables removed and listed in the worklog
  - [x] contracts (`orderSchedule`, `nextOrder`, `requireCompleteWhenEnabled`)
  - [x] `CatalogService` writes the schedule and `scheduleActiveSince`; `CatalogMapper` reads
        it and computes `nextOrder`; `catalog.mapper.spec.ts` case with a fixed `now`
  - [x] cases: round trip; 400 for an enabled schedule missing each required field; a disabled
        partial schedule is accepted; switching on sets `scheduleActiveSince`; an unrelated edit
        does not move it
  - [x] `pnpm generate`; commit
- [x] **3. The schedule on the supplier, in the SPA**
  - [x] red first: `supplier-order-schedule.spec.ts` (browser)
  - [x] supplier dialog on react-hook-form with the contact e-mail (ruling: contact e-mail goes in the dialog)
  - [x] `supplier-schedule-dialog.tsx`, the "Prochaine commande" column, i18n fr and en
  - [x] the browser test also shows a refused incomplete schedule (the save stays disabled and
        names the missing field)
  - [x] commit
- [ ] **4. E-mail copies and attachments**
  - [ ] red first: the new case in `email.service.spec.ts`
  - [ ] `EmailOptions.cc`, `EmailOptions.attachments`; the two existing cases green unchanged
  - [ ] commit
- [ ] **5. Admin addresses and the purchasing notices**
  - [ ] red first: `supplier-order-notice.service.spec.ts` (real test database, fake mail)
  - [ ] `members/admin-addresses.ts`; `MemberNoticeService` uses it; its spec green unchanged
  - [ ] `SupplierOrderNoticeService`: summary, failure alert, missed-distribution alert; banned
        and phone-only admins skipped; a mail rejection is logged, never thrown
  - [ ] commit
- [ ] **6. The order e-mail on the manual send**
  - [ ] red first: the new `describe` in `purchasing.controller.e2e-spec.ts` (fake
        `EmailService` through `providers`)
  - [ ] `SupplierOrderMailService` + `OrderMailError`; `PurchasingMapper.toExport` reused for
        the attachment; the attachment equals the export route's `content` in the test
  - [ ] `PurchasingService.send` with the row lock, `markSent`, 502 `order_mail_failed`, the
        admin alert; contract and mapper expose `sentMode`, `sentTo`
  - [ ] cases: supplier and referent addresses (`manual-send-mails`); referent with no address
        gets no copy; no supplier address → sent, `sentTo` null, no mail
        (`manual-send-without-address`); mail error → 502, still draft, one alert per admin
        (`manual-failure-alert`); the lot 3 send cases green unchanged
  - [ ] aggregation split into `collectPendingLines` / `createDraft`; lot 3 aggregation cases
        green unchanged
  - [ ] `pnpm generate`; commit
- [ ] **7. How the order was sent, in the SPA**
  - [ ] red first: `admin-purchasing-send-mail.spec.ts` (browser, maildev)
  - [ ] `E2E_ORDER_MAIL` fixtures and seeding
  - [ ] the "sent how" line on the detail; the three send toasts; i18n fr and en
  - [ ] commit
- [ ] **8. The automatic run**
  - [ ] red first: `supplier-order-schedule.service.spec.ts`, the `auto-send` case
  - [ ] `SupplierOrderScheduleService.runDue(now)`
  - [ ] cases, each by passing instants: before the moment (nothing); at the moment (sent,
        `automatic`, summary to each admin with supplier, distribution day, line count); a
        second pass (nothing); already sent by hand in the window (nothing,
        `auto-skips-when-done`); an older draft plus new pre-orders (two e-mails, both sent,
        `auto-sends-existing-draft`); nothing pending and no draft (no mail,
        `auto-nothing-to-order`); late but before the distribution (sent,
        `auto-late-catch-up`); after the distribution started (nothing sent, one missed alert,
        and a later pass raises no second alert); no supplier address (draft, alert); mail
        error (draft, alert, and a later pass does not retry, `auto-failure-alert`); archived
        supplier (skipped); schedule switched on after the moment (nothing); two `runDue` at
        once on two forks of the ORM (one e-mail, `auto-once-per-distribution`)
  - [ ] commit
- [ ] **9. The job**
  - [ ] red first: `supplier-order-schedule.job.spec.ts`
  - [ ] `SupplierOrderScheduleJob`, `ScheduleModule.forRoot()` in `AppModule`, providers in
        `PurchasingModule`; `disabled: config.e2e`
  - [ ] commit
- [ ] **10. Documentation and gates**
  - [ ] new page `apps/documentation/src/content/docs/project/automatic-supplier-orders.mdx`
        (the rule, the run, the lock, the alerts, the known duplicate-mail limit), linked from
        `lot-3-purchasing.mdx`; `generate:index`; documentation build
  - [ ] glossary: "distribution day" and "sending moment" if the Architect agrees they are
        domain words
  - [ ] gates: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm e2e` (after
        `docker ps`), each in the background with its full log read
  - [ ] commit

## Notes & Snippets

### Questions for the Architect (the spec is unclear or conflicts with the code)

**The "already sent" window catches the run's own previous send.**

- Fact: the spec defines "already sent for this distribution" as an order of the supplier with
  `sentAt` after the previous sending moment of the rule (Implementation Decisions, and the
  criterion `auto-skips-when-done`). The job ticks every few minutes, so the automatic send for
  the previous distribution has a `sentAt` a few minutes **after** the previous sending moment.
- Problem: when the next distribution comes, the run finds that order and skips. After its
  first automatic send, a supplier would never be sent automatically again. A late catch-up
  makes the gap hours or days, same result.
- Options:
  1. The window starts at 00:00 Paris on the previous distribution day. Every send for the
     previous distribution, even a late catch-up, happens before that day starts, and the
     sending day of this distribution is never before it (it is at most 7 days before, and two
     distributions are at least 7 days apart).
  2. Keep "after the previous sending moment" but ignore orders sent `automatic` for the
     previous distribution. Needs the distribution day stored on each order.
  3. Store the distribution day on every sent order and compare days. Manual sends would have
     to guess their distribution.
- Recommendation: option 1. It needs no new column, and it keeps the spec's intent (a manual
  send between two distributions counts for the next one). It changes the wording of a 🧑
  line, so the human confirms it.

**No screen sets a supplier's address or its referent.**

- Fact: the SPA's supplier dialog edits the name and the type only. `contactEmail` and the
  referent exist in the API but no screen writes them.
- Problem: from the app, every supplier has no address, so a manual send never mails and every
  automatic send fails with "no address". The feature cannot be used without an address.
- Options:
  1. Add the contact e-mail to the supplier dialog in step 3 (and convert the dialog to
     react-hook-form). The referent stays API-only for now; the copy works when one is set.
  2. Also add a referent picker (the referents list route exists). More UI, and the spec does
     not mention it.
  3. Neither: addresses are set by a seed or by hand in the database.
- Recommendation: option 1. One field, plainly needed by `manual-send-mails`; the referent
  picker can be its own small task.

**Late switch-on.** Not a conflict, a decision to confirm: a schedule switched on (or changed)
after this distribution's sending moment does nothing for this distribution, no send and no
alert (`scheduleActiveSince`). Otherwise the first tick after the save would mail the supplier
at once.

### Rulings at the reading (Architect, 2026-11-26)

- **"Already sent" window:** option 1. The window starts at 00:00 Paris on the previous
  distribution day. The spec's criterion `auto-skips-when-done` and its Implementation
  Decisions line are amended, signed, old text struck. Add a service test: the automatic send
  for the previous distribution does not block this one, and a manual send after the previous
  distribution day does.
- **Supplier address:** option 1. The contact e-mail goes in the supplier dialog in step 3,
  and the dialog moves to react-hook-form. No referent picker in this task.
- **Late switch-on:** confirmed. A schedule switched on or changed after this distribution's
  sending moment does nothing for it: no send, no alert.

## Diff-Review Findings
