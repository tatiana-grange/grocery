# Send supplier orders automatically, on each supplier's rhythm

**Status:** in-progress — spec approved by the human on 2026-11-26; Mason launched the same day

---

> 🧑 **REVIEW CAREFULLY** — human decision surface. Read it all before code.

## Context

Members pre-order products. Staff then gather the pending pre-orders of one supplier into a
supplier order and press "Send". Today "Send" only changes the order's status: no e-mail
leaves the app, so someone still has to pass the order by hand, and has to remember to do
it on the right day. On Monépi, the board relied on automatic sending, and orders were
missed when it failed (the Pinier and Bertrand orders, autumn 2026; Eugénie turned the
automatic suppliers off in December 2025 when the mail broke).

Each supplier delivers on its own rhythm. Some deliver every week on a fixed day. Some
deliver one week in two (only in even weeks, for example). Some deliver once a month, such
as the flour: the first Friday of the month, with the order sent the last Wednesday before.

Decisions taken by the human on 2026-11-26:

- **The rhythm is set on the distribution**, and the sending day is computed from it.
  - Weekly distribution: a weekday, and "every week", "even weeks" or "odd weeks". Even and
    odd follow the week number of the calendar (ISO week numbers, the ones printed on French
    calendars).
  - Monthly distribution: "the 1st, 2nd, 3rd, 4th or last" weekday of the month.
  - Sending: "the last [weekday] before the distribution", at a fixed hour.
- **"Send" means an e-mail to the supplier**, with the order's detail in the body and the
  CSV attached, as on Monépi. The supplier's referent gets a copy. The manual "Send" button
  sends the same e-mail.
- **Fully automatic.** On the sending day, if no order has gone to this supplier for that
  distribution yet, the app gathers the pending pre-orders and sends. Nothing to order means
  nothing is sent. The admins get a summary of what was sent, and an alert when a send fails.

## Scope

**Included:**

- A sending schedule on each supplier: on or off, the distribution rule, the sending weekday,
  the sending hour. Set from the supplier form in the catalog.
- The next distribution date and the next sending moment, shown on the supplier.
- The order e-mail to the supplier (body plus CSV, referent in copy), for the manual "Send"
  and for the automatic one.
- A job inside the API that runs the automatic sends when their moment comes.
- The admin summary after an automatic send, and the admin alert when one fails or cannot
  happen.
- On a supplier order, whether it was sent by hand or automatically, and to which address.

**Not Included:**

- Showing the pickup date on products (Plane GRO-7). The distribution dates computed here
  will serve it later.
- Exceptions to a rhythm (a skipped week, holidays). The admins turn the schedule off and on.
- Several distribution rules for one supplier.
- Rhythms other than those above (every three weeks, twice a week, the 15th of the month).
- Retrying a failed e-mail on its own. A failed send is left for an admin to resend by hand.
- Any change to how pre-orders are gathered (the aggregation of lot 3 stays as it is).

## Acceptance Criteria

- [ ] **schedule-on-supplier** — An admin turns the schedule on for a supplier and sets the
  distribution rule, the sending weekday and the hour. The API refuses an incomplete schedule
  that is turned on.
- [ ] **next-dates-shown** — The supplier shows its next distribution date and its next
  sending moment, both in Paris time. Example: flour, first Friday of the month, sent the last
  Wednesday before at 8:00. From Thursday 26 November 2026 the next distribution is Friday
  4 December and the next sending is Wednesday 2 December at 8:00.
- [ ] **monthly-rule** — "The 1st … 4th or last [weekday] of the month" gives the right dates
  over a year of months, including a month where the first Friday is the 1st (the sending
  Wednesday then falls in the month before).
- [ ] **even-odd-weeks** — "Even weeks" and "odd weeks" follow the ISO week number. A year
  with a week 53 is followed by week 1: the rule follows the numbers, so two odd weeks can
  come in a row. The test names that case.
- [ ] **sending-day-before** — The sending day is strictly before the distribution day: a
  Friday distribution with sending on Friday is sent the Friday a week earlier.
- [ ] **manual-send-mails** — Pressing "Send" on a draft order e-mails the supplier's address,
  the referent in copy when the referent has an address, with the CSV attached. When the
  e-mail fails, the order stays a draft and the admin sees an error.
- [ ] **manual-send-without-address** — A supplier with no address: "Send" marks the order
  sent, as today, and says that no e-mail left.
- [ ] **auto-send** — At the sending moment, for a supplier whose schedule is on, the app
  gathers the pending pre-orders and e-mails the order. The order is marked sent
  automatically.
- [ ] **auto-skips-when-done** — If an order to this supplier was already sent since the
  previous sending moment, the automatic run sends nothing for this distribution.
- [ ] **auto-sends-existing-draft** — A draft already waiting for this supplier is sent by the
  automatic run, together with the newly gathered lines.
- [ ] **auto-nothing-to-order** — No pending pre-order and no draft: nothing is sent, nothing is
  mailed.
- [ ] **auto-once-per-distribution** — The automatic run handles each distribution of a
  supplier at most once, even when the job ticks again or two API processes run.
- [ ] **auto-late-catch-up** — If the API was down at the sending moment, the run happens when
  it comes back, as long as the distribution has not started. After that, nothing is sent and
  the admins are alerted.
- [ ] **auto-failure-alert** — No supplier address, or an e-mail error: the order stays a draft
  and every admin gets one alert e-mail naming the supplier, the order and the reason. A failed
  send is never retried on its own; this alert is how the admins learn they must resend it.
  (Human, 2026-11-26.)
- [ ] **manual-failure-alert** — A manual "Send" whose e-mail fails also sends that alert to
  every admin, besides the error on screen. (Human, 2026-11-26.)
- [ ] **admin-summary** — After each automatic send, the admins get one e-mail naming the
  supplier, the distribution date and the number of lines.
- [ ] **sent-how-shown** — The order detail shows "sent by hand" or "sent automatically", and
  the address it went to, or that no e-mail left.
- [ ] **suite-green** — lint, typecheck, API tests, build and the browser suite pass.

## Seams

- **Schedule rule** — a pure function: given a supplier's schedule and an instant, it returns
  the next distribution date and its sending moment, in Paris time. All the date criteria are
  tested here, without a database.
- **Order e-mail** — a service: given a supplier order, it builds and sends the e-mail with
  its CSV. It is the only place that knows the e-mail's content. Tested with a fake mail
  transport.
- **Send** — `POST /admin/purchasing/supplier-orders/:id/send`: unchanged route, now sends the
  e-mail before marking the order sent.
- **Automatic run** — a service method called with "now", which the job calls on each tick.
  It is tested by passing instants, never by waiting on a clock.
- **Supplier routes** — the existing supplier create, update and read routes carry the
  schedule and the next dates.

## Architecture

**System design:** the schedule lives on the supplier (catalog module), as a few nullable
columns. The purchasing module owns the automatic run, the order e-mail and the send. A job
built on `@nestjs/schedule` (already a dependency, unused so far) ticks every few minutes
and calls the automatic run. The run sets its own MikroORM context, as the constitution asks
for code outside a request. To handle a distribution once, the run takes a row lock on the
supplier and writes on it the distribution date it handled, in the same transaction as the
order's status change. The e-mail is sent before that transaction commits its "sent" state,
so a failed e-mail leaves the order a draft. The admin summary and alert follow the wallet
notice pattern: they never fail the run.

The CSV attachment reuses the existing export and the shared CSV writer of lot 7, so the
attached file is byte for byte the export staff download today. The e-mail service gains
attachments and copies.

```
Supplier (schedule)  ──►  Schedule rule (pure)  ──►  next distribution, sending moment
                                                        │
Job tick (every few minutes) ──► Automatic run ─────────┘
                                   │ lock supplier, check "already sent"
                                   │ aggregate pending lines, gather drafts
                                   ▼
                     Order e-mail (body + CSV, referent cc) ──► supplier
                                   │ ok: mark sent (automatic) │ fail: stays draft
                                   ▼                            ▼
                           admin summary                   admin alert
```

---

> 🧑 **REVIEW IF RELEVANT** — decisions, testing, slicing.

## Implementation Decisions

- **Paris time** everywhere a day or an hour is read, with the time zone constant of the
  accounting module (`COOPERATIVE_TIME_ZONE` in `apps/api/src/modules/accounting/period.util.ts`).
  Move it to a shared place if the plan needs it in two modules.
- **"Already sent for this distribution"** means: an order of this supplier with a `sentAt`
  after the previous sending moment of the rule. Pre-orders made after a manual send wait for
  the next distribution.
- **Several drafts** waiting for one supplier at the sending moment: each draft is a supplier
  order, and each is sent as its own e-mail. The plan may merge them only if lot 3's rules
  allow it without touching aggregation.
- **The distribution is "started"** at 00:00 Paris time on its day, for the late catch-up rule.
- **No new status.** A supplier order stays `draft → sent → received | closed`. How it was sent
  and to which address are two new nullable columns, written once at sending.
- **The schedule refers to nothing that can be archived.** An archived supplier is skipped by
  the run.
- **Migrations:** one generated migration, read and cleaned as `AGENTS.md` asks (the eight
  search indexes).
- **French wording** in the UI and in the e-mails, as in the rest of the app.

## Testing Strategy

- Schedule rule: unit tests for weekly, even, odd and monthly rules, the ISO week 53 case,
  the sending day equal to the distribution day, a sending day in the previous month, and a
  daylight-saving change (last Sunday of March and of October).
- Automatic run: service tests that pass instants: before the moment (nothing), at the moment
  (sent), a second tick (nothing), already sent by hand (nothing), late but before the
  distribution (sent), after the distribution started (alert), no address and mail error
  (draft and alert), two runs at once (one send).
- Send route: API tests with the test mail transport for the manual e-mail, the missing
  address and the mail error.
- Browser: the supplier form sets a monthly schedule and shows the next dates; the order
  detail shows how it was sent.

## Slices & Dependencies

- **Sizing:** one task, one pass. It is the size of lot 6 or lot 7, which each went through in
  one plan of seven to nine steps.

## Deliverables

- [ ] Supplier schedule (columns, contract, form, next dates)
- [ ] Order e-mail on manual send
- [ ] Automatic run and its job
- [ ] Admin summary and alert
- [ ] A documentation page for the automatic sending, linked from the lot 3 page
- [ ] Journal entry

## References

- `apps/documentation/src/content/docs/project/lot-3-purchasing.mdx` — what aggregation,
  send, receive and close do today, and the order status machine.
- `apps/api/src/modules/wallet/member-notice.service.ts` — the pattern for admin e-mails that
  never fail the action behind them.
- `apps/documentation/src/content/docs/references/constitution.mdx`, "Immutable Money and
  Stock Ledgers" — code outside a request sets its own MikroORM context.
- `apps/documentation/src/content/docs/project/monepi-features.mdx`, "Admin — ordering and
  billing" — Monépi sends supplier orders as e-mails with a CSV attached.
- Plane GRO-7 — the pickup date on products, which will reuse the distribution dates.

## Notes

- 2026-11-26, Architect: the request came from the board's WhatsApp group (Fanny, then the
  failed Pinier and Bertrand orders). The human set the rhythm model, the meaning of "send"
  and the fully automatic run in this session; the even and odd weeks were added by the
  human the same day.
- 2026-11-26, Architect: when the mail server itself is down, the alert cannot leave either.
  The run then logs the failure as an error, and the order stays a draft, visible in the list.
  The human asked that every failed send, automatic or manual, alert every admin by e-mail.

## Retrospective
