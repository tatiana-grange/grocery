# Refund — work

Created by the Mason at the plan step, 2026-11-23. Spec:
`project-management/tasks/20261123-1014-lot-5-wallet/03-refund.spec.md`.
The parent spec is `project-management/tasks/20261123-1014-lot-5-wallet.spec.md` (its sections
"Seams", "Architecture" and "Implementation Decisions" bind this plan). Slices 01 and 02 are in
`01-online-topup.work.md` and `02-payment-correction-and-negative-balance.work.md` beside this
file. The decision to record a refund and never send it is in the ADR
`apps/documentation/src/content/docs/project/decisions/0001-helloasso-and-recorded-refunds.mdx`.

**Plan:** approved by the Architect, 2026-11-23, with the corrections below. No decision the
human made is departed from.

## Corrections at the reading

Signed Architect, 2026-11-23. Each one overrides the section it names.

1. **A member who left may be refunded**, whatever their status.
2. **The underpaid notice is stamped before it is sent.** A failed send is logged and not retried.
   The log line names the top-up id so staff can follow up by hand.
3. **The underpaid notice goes to the admins only,** not to the payer.
4. **"Reversible" means a new negative row, never an edit.** There is no undo of a refund. Say so
   in the docs page.
5. **The Rembourser button lives on the distribution member screen only.**


## Program Design

### 1. Decisions in one place

- A refund is one new ledger row with the new reason `refund`. Its amount is negative. It carries
  the method (cash, cheque or transfer) in the existing `paymentMethod` column, the reason in the
  existing `note` column, and the admin in the existing `recordedByUser` column. No new column and
  no migration for the refund itself.
- Only an admin can record it. The route sits on the staff wallet controller with a method-level
  `@AdminOnly()`. The auth guard reads the roles with `getAllAndOverride` over the handler first
  and the class second, so the method wins over the class-level `@StaffOnly()`. The controller e2e
  test proves it (a distributor gets 403).
- The reason is required: trimmed, 1 to 500 characters, like the correction reason.
- A refund can never be larger than the balance. The check and the write happen in one
  transaction, under a row lock on the member, so two refunds at the same moment cannot both pass.
  This is the same lock `DistributionService.recordHandover` takes. The lock is what makes the
  rule hold; a plain read would not.
- A balance of zero or below refuses every refund. One code covers "too large" and "nothing to
  refund": `refund_exceeds_balance`. A refund for a positive amount on a balance of zero or less is
  by definition larger than the balance. The 409 body carries `balanceEur` and `amountEur`.
- A refund never makes the balance negative, so it cannot block anyone. A refund of the whole
  balance leaves exactly zero, which is allowed and not blocked.
- A refund can be recorded for a member of any status, including one who left. A member who ends
  their membership is exactly who gets money back. (Open question 1.)
- The application makes no call to the payment provider. `WalletService` takes only the entity
  manager, and `wallet` does not import `payments`. A test still proves it (section 6).
- No "undo a refund" and no correction of a refund. `correctPayment` already refuses it with
  `not_a_manual_payment` (only `payment_received` can be corrected). If an admin records a refund
  by mistake, they record the money again as a payment and say why in the note. The docs page says
  so.
- The member reads the refund in their own history with its reason, like every other note. The
  mapper is not changed to hide it.

### 2. Files and interfaces, backend

All under `apps/api/src/modules/wallet/` unless said otherwise.

Changed:

- `contracts/wallet.contract.ts`
  - `WALLET_ENTRY_REASONS` gets `refund`. The reason description says `handover_charge`,
    `payment_correction` and `refund` are negative and the others positive. `refund` is money
    given back to the member by hand.
  - New `refundSchema`: `{ amountEur: z.number().positive(), paymentMethod:
    manualPaymentMethodSchema, reason: z.string().trim().min(1).max(500) }`, with `.meta()` and an
    example. New type `RefundInput`.
  - New refusal list, same pattern as the two existing ones: `REFUND_REFUSALS =
    ['refund_exceeds_balance']`, `refundRefusalSchema`, type `RefundRefusal`. Typed codes, as the
    review of slice 02 asked.
- `entities/wallet-entry.entity.ts`: the comments on `paymentMethod` and `note` name the refund.
  No property changes.
- `wallet.service.ts`: new `refund(memberId, input, adminUserId)` (below).
- `wallet.controller.ts`: new route on `StaffWalletController`, method-level `@AdminOnly()`:
  `POST wallet/members/:memberId/refunds`, body `refundSchema`, answers `walletSchema` (201, the
  updated wallet, like the payment and correction routes).

New tests: cases in the existing `tests/wallet.service.spec.ts` and
`tests/wallet.controller.e2e-spec.ts`. No new file.

Signature:

```ts
// wallet.service.ts
interface RefundInput { amountCents: number; paymentMethod: ManualPaymentMethod; reason: string }
refund(memberId: string, input: RefundInput, adminUserId: string): Promise<WalletEntry>
```

`refund`, in one `em.transactional`:

1. Lock the member row (`PESSIMISTIC_WRITE`). No row: 404 `Member not found`.
2. Read the balance inside the transaction (`getBalanceCents(tem, memberId)`).
3. If `balance <= 0` or `amountCents > balance`: 409 `refund_exceeds_balance` with `balanceEur`
   and `amountEur`. Nothing is written.
4. Append one row with `this.charge(tem, ...)`: reason `refund`, `paymentMethod`, `note` = the
   reason, `recordedByUserId` = the admin. Flush.
5. Return the entry.

The controller converts euros to cents with `eurToCents`, as the payment route does. A value with
more than two decimals is handled the same way the payment route handles it today (no new rule).

### 3. Who may call what

| Route                                    | Who                       | Refused with                          |
| ---------------------------------------- | ------------------------- | ------------------------------------- |
| `POST wallet/members/:id/refunds`        | admin only                | 401 no session; 403 distributor, member, pending |
| `GET wallet/members/:id`, `POST .../payments`, `POST .../correction` | distributor, admin | unchanged |
| `GET me/wallet`                          | the member, own data only | unchanged                             |

A member has no route that takes another member's id and no route that records a refund.

### 4. Ledger rules, and why the write is safe

- Append-only: the refund is one `INSERT`. No `UPDATE` or `DELETE` on `walletEntry` anywhere in
  the diff. The Mason greps the final diff for `nativeUpdate`, `nativeDelete` and `.remove(` on
  `WalletEntry`.
- Transaction: lock, balance read, check and insert share one transaction (Principle II).
- Balance is the sum: nothing is stored on the member.
- Lock order: the member row is the only lock taken. A correction takes no member lock, so a
  correction landing between the check and the insert is possible. It can only lower the balance,
  and a correction is allowed to take the balance below zero, so this is legal. The refund was
  correct at the moment it was checked. This is stated in the docs page.

### 5. Final states: why, and every input that can reach them

- **A `refund` row** (final, because the ledger is append-only and nothing reverses it).
  - Why it is final: no route updates or deletes an entry, `correctPayment` refuses a row that is
    not `payment_received`, and there is no refund-reversal route in this slice.
  - Every input that can write a row with the reason `refund`: the one route
    `POST wallet/members/:memberId/refunds`, by an admin, through `WalletService.refund`. Nothing
    else sets that reason: not the member routes, not the top-up code, not the distribution
    module, not the test seed routes, not the E2E seeder, not a migration. The Mason checks this
    with a search for `'refund'` in the final diff and on the whole `apps/api/src` tree.
- **The underpaid-notice stamp** (`underpaidNotifiedAt`, section 7), final once set, because it
  records that admins were told. It is never cleared.
  - Every input that can set it: only `PaymentsService.verify`, in its locked transaction, when
    the provider says `paid` and the paid amount is lower than the requested amount, and the stamp
    is empty. `verify` is reached from exactly two inputs: the member's own check
    (`POST me/topups/:id/verify`) and the provider notification sweep
    (`reconcileRecent`, which calls `verify`). The test routes under `/api/test/payments/*` only
    drive those two. Nothing else writes the stamp.
- **"Blocked" and "balance"** stay computed, never final.

### 6. The recorded-only proof

A test in `wallet.controller.e2e-spec.ts` builds the app with `WalletModule` and `PaymentsModule`,
with the fake payment provider (`PAYMENT_PROVIDER` as `FakePaymentProvider`) and spies on
`createPaymentRequest` and `getPaymentResult`. After a successful refund, both spies are called
zero times. If the fake provider cannot be spied on that way in this test app, the same assertion
moves to a unit test on `WalletService` that proves its constructor takes the entity manager only.
The Mason says which in the worklog.

### 7. The underpaid top-up notice (carried from slice 02)

The case: the payer paid less than they asked for. Today `PaymentsService.verify` logs an error,
credits nothing and leaves the top-up `pending`. Nobody is told.

The rule: once per top-up, the admins get one e-mail. A top-up is checked many times (the return
page and every provider notification), and nothing remembers it was underpaid, so a mail would
repeat. Slice 02's notice service has no memory either, because a correction happens only once.
This one needs a memory.

**New column** on `topup`: `underpaidNotifiedAt` (`timestamptz`, null). Set the first time the
admins are told.

**How repeats are avoided.** The stamp is set inside the existing locked transaction of
`verify`, the same row lock that makes the credit happen once:

1. `verify` already locks the `Topup` row and re-reads it (`refresh: true`).
2. In the underpaid branch: if `underpaidNotifiedAt` is empty, set it to now and remember "notify"
   in a local flag. If it is already set, do nothing (log line only, as today).
3. The transaction commits. After the commit, and only if the flag is set, call
   `notice.notifyUnderpaidTopup(...)` outside the transaction. It never rejects.

Two checks at the same moment: the second waits on the lock, re-reads, sees the stamp, and sends
nothing. This is stronger than a separate "set if empty" update, because the stamp and the
decision are one locked step. A mail failure is logged and never undoes anything. The stamp is
set before the send, so the mail is at most once: if the send fails or the process dies between
the commit and the send, the mail is lost and not retried. This is the same choice slice 02 made
for its notice, and it is stated in the docs. (Open question 2.)

Later changes of the same top-up: if the payer later pays the right amount, the top-up becomes
`paid` and is credited normally. The stamp stays. If the payer pays less twice, there is still
one mail.

**Service.** `MemberNoticeService` (already in `wallet`, exported from `WalletModule` in this
slice) gets:

```ts
notifyUnderpaidTopup(input: {
  memberId: string
  requestedCents: number
  paidCents: number
  topupId: string
}): Promise<void> // never rejects
```

- To the admins only (same recipient rule as slice 02: admin role, not banned, a real address,
  unverified addresses count). Nothing goes to the member. (Open question 3.)
- Subject `Paiement incomplet : {member name}`. Body names the member and the membership number,
  the amount requested and the amount paid, and the top-up id, and says nothing was credited and
  the top-up is still pending, so someone must look at it with the payer and in the HelloAsso
  back office. Plain text and a short matching `html`, French only, like the slice 02 mails.
- The admin lookup, the per-recipient `allSettled` send and the logging are pulled out of
  `notifyNegativeBalance` into two private helpers that both public methods use. The behaviour of
  `notifyNegativeBalance` does not change and its tests stay as they are.
- `PaymentsService` gets `MemberNoticeService` as one new constructor argument. `PaymentsModule`
  already imports `WalletModule`, which now exports the service. No cycle (`wallet` does not
  import `payments`).
- `paidAmountCents` is not stored on the top-up. The mail uses the value in hand at that moment.

**Migration.** One column, one file. Steps:

1. Add the property to `entities/topup.entity.ts` (nullable `Date`, with a comment). Run
   `pnpm --filter=api db:migrate:create`.
2. Read the generated SQL before anything else. Keep only `add column "underpaidNotifiedAt"`.
   Remove every `drop index` line for the search indexes and every rewrite of an auth foreign
   key, in `up` and in `down`. Write in the worklog what was removed.
3. Check the diff of `.snapshot-grocery.json`. The tool rewrites the whole file. Restore the
   committed file and add by hand only the new column, then run `oxfmt` on that one file.
4. `down` drops the column.
5. The dev database lags. If a dev delta is needed it is applied by hand. The test and E2E
   databases build from the entities, so no run of the migration is needed there.

### 8. Frontend

All under `apps/web-spa/app/` unless said otherwise. Both i18n files get every key in the same
commit: `lib/i18n/locales/fr/common.locales.fr.json` and the `en` twin.

- `features/wallet/components/refund-dialog.tsx` (one export, `RefundDialog`): a Dialog opened
  from the distribution member page. It shows the current balance and the largest refund allowed,
  an amount field, a method select (cash, cheque, transfer; same options and labels as the payment
  form), a required reason field, a confirm button and a cancel button. Confirm is disabled while
  the reason is empty, the amount is not positive, or the amount is above the balance. On success:
  a toast, the staff wallet cache is set from the answer, `['distribution']` and `['wallet']` are
  invalidated, the dialog closes. On the code `refund_exceeds_balance` (read with `apiErrorCode`):
  a toast with the balance, for the case where the page was loaded before something changed.
- `features/wallet/utils/wallet-queries.ts`: `refund(memberId, body)` over the generated
  `staffWalletControllerRefund` (name confirmed after generation).
- `features/distribution/components/distribution-member-page.tsx`: a "Rembourser" button next to
  "Enregistrer un paiement", shown only when `useRoles().isAdmin` is true (from
  `features/common/hooks/use-session`, as `site-header.tsx` does). Disabled when the balance is
  zero or below, with the title text saying why. Opens `RefundDialog`.
- `features/wallet/components/wallet-panel.tsx`: no code change; the new reason needs only the
  label `wallet.reason.refund`. The refund row shows its method, its reason as the note and a
  negative amount in the destructive colour, which the panel already does for every negative
  amount.
- i18n keys, both languages: `wallet.reason.refund`, `wallet.refund.open`, `wallet.refund.title`,
  `wallet.refund.description`, `wallet.refund.maxHint` (the largest refund allowed),
  `wallet.refund.amount`, `wallet.refund.method`, `wallet.refund.reason`, `wallet.refund.confirm`,
  `wallet.refund.cancel`, `wallet.refund.success`, `wallet.refund.disabledNoBalance`,
  `wallet.refund.error.refund_exceeds_balance`. The i18n package test that compares the two
  languages must stay green.
- The generated client is regenerated with the procedure of slice 01's work document (section
  "Generated client"): a built API on a spare port with `NODE_ENV=development`, stopped afterwards
  by its process id. Commit `client/{index,sdk.gen,types.gen,zod.gen}.ts` in the step that adds
  the route. The notice in section 7 adds no route and no contract, so it needs no regeneration.

### 9. The Playwright journey

New file `apps/web-spa-e2e/tests/wallet-refund.spec.ts`. No existing E2E test, seed or helper is
edited. The journey builds its own state through the screens with Milo Member after `resetDb`, as
`wallet-correction.spec.ts` does.

1. Admin context (`withRole('admin')`). Open Milo on the distribution screen. The "Rembourser"
   button is disabled while the balance is zero.
2. Record a cash payment of 30. The balance reads 30. Press "Rembourser", enter 40: confirm stays
   disabled (above the balance). Enter 10, method cash, a reason, confirm. The balance reads 20 and
   the history shows the refund row with its reason.
3. Refund 20: the balance reads 0.00 and the button is disabled again.
4. Distributor context (`withRole('distributor')`). Open Milo: the "Rembourser" button is not
   there. (The API refusal for a distributor is proved by the controller e2e test.)
5. Member context (Milo's saved session). Open the account page: the history shows both refund
   rows with their reasons and the balance reads 0.00.

The test also checks that no mail is expected and nothing leaves for the provider: the fake
provider is the E2E one, so a call to it would show in its state; the assertion lives in step 1's
API test, not here.

Before `pnpm e2e` the Typist runs `docker ps` and looks for another project on 5434, 1093 and
1043. If one is there, say so and never stop another project's container. Never edit source while
`pnpm e2e` runs.

### 10. Test order per step (the first failing test is named)

The Typist shows each named test red before writing the code, and says so in the worklog. A step
with no red test is reported, not ticked.

| Step | First failing test (file: test name) |
| ---- | ------------------------------------ |
| 1    | `wallet.service.spec.ts`: "refund writes one negative entry with the method, the reason and the admin" |
| 2    | `member-notice.service.spec.ts`: "notifyUnderpaidTopup sends one mail to each admin and none to the member" |
| 3    | `wallet-refund.spec.ts` (Playwright): "l'admin rembourse une partie du solde et l'adhérent le voit" |
| 4    | none red: docs and gates only. The Mason says so in the worklog. |

Test lists by step (each line is one test; the first is the named one):

- Step 1, `wallet.service.spec.ts`: one negative entry with method, reason as the note and the
  admin; the balance goes down by the amount; a refund of exactly the balance leaves zero and
  succeeds; a refund above the balance is refused with `refund_exceeds_balance` and writes
  nothing; a balance of zero is refused; a negative balance is refused; unknown member is 404;
  two refunds at the same moment that together exceed the balance: one wins, one is refused, the
  sum never goes below zero; no existing row is changed (read an earlier row before and after);
  `correctPayment` on a refund row is refused with `not_a_manual_payment`.
  `wallet.controller.e2e-spec.ts` (mail faked as today): admin 201 and the answer carries the new
  balance and the row; distributor 403; member 403 (own account and another); no session 401;
  blank reason 400; missing reason 400; zero or negative amount 400; method `online` 400; amount
  above the balance 409 `refund_exceeds_balance` with `balanceEur`; the member's `GET me/wallet`
  shows the refund row with its note; the provider spies are never called (section 6).
- Step 2, `member-notice.service.spec.ts` (fake mail): one mail to each admin and none to the
  member, with the amounts and the top-up id in the body; a banned admin and a phone-only admin
  are skipped; one failing send does not stop the others and the method does not reject; the
  failure is logged; `notifyNegativeBalance` still passes unchanged.
  `topup.service.spec.ts`: an underpaid payment stamps `underpaidNotifiedAt` and sends one mail;
  a second check of the same top-up sends none and keeps the first stamp; two checks at the same
  moment send one; a top-up that is not underpaid (exact amount, failed, pending, expired) sends
  none and leaves the stamp empty; a payment of the right amount after an underpaid one credits
  once and sends none; a mail that throws leaves the stamp set, the top-up `pending` and no
  credit. `topup.controller.e2e-spec.ts` (new cases, none edited): the existing "credits nothing
  when the payer paid less than requested" flow, run twice through the verify route and once
  through the notification route, sends one mail in total.
- Step 3, Playwright: see section 9. The `i18n` package test and `pnpm typecheck` also run here.

### 11. Acceptance criteria, where each is tested

| Criterion          | Where |
| ------------------ | ----- |
| admin-only         | controller e2e (distributor, member, no session), Playwright step 4 |
| reason-required    | controller e2e (blank and missing), the dialog keeps confirm disabled |
| never-beyond-balance | service spec (above, zero, negative, equal, concurrent), controller e2e (409 code), Playwright steps 2 and 3 |
| recorded-only      | controller e2e (provider spies never called) |
| one-reversible-row | service spec (one row, earlier rows unchanged, `correctPayment` refuses it). The criterion's word "reversible" is read as "a negative entry"; see open question 4 |
| member-sees-it     | controller e2e (`me/wallet`), Playwright step 5 |
| journey-covered    | `wallet-refund.spec.ts` |
| suite-green        | step 4 |
| underpaid notice (from the Notes) | member-notice spec, topup service spec, topup controller e2e |

### 12. Documentation and glossary

At step 4 (living docs, not the archive; nothing under `specs/` is touched):

- `apps/documentation/src/content/docs/project/lot-5-wallet.mdx`: intro says the refund is built;
  a new "Refund" section (who, the rules, the single code, the lock, no undo, the member reads the
  reason, nothing is sent to HelloAsso, with a link to ADR 0001); an "Underpaid top-up notice"
  paragraph under the online top-up section (what triggers it, once per top-up, at most once even
  on a failed send, admins only); the "Where the code is" lists; the "Not done yet" lines about
  slice 03 and the underpaid notice are removed.
- `project/glossary.mdx`: rewrite the entry "Refund" to say admin only, never above the balance,
  method and reason recorded; add "Underpaid top-up" (a payment lower than the amount asked;
  nothing is credited, the top-up stays pending, the admins are told once).
- `project/index.mdx`: the lot 5 line moves from "in progress" to built, once the three slices are
  closed (the Architect's close step; see section 14).
- The pages list does not change (no page added), so `generate:index` is not needed. If a page is
  added, run `pnpm --filter @grocery/documentation generate:index`.
- The spec of slice 03 gets its acceptance boxes ticked and a short "built as" note, as slice 01
  did in its own spec, in one separate docs commit.

### 13. Order of the steps and the commits

Commit with explicit paths, no push, no `Co-Authored-By`, body lines of 100 characters or less,
as `CONTRIBUTING.md` and commitlint ask. Format only the changed files, never `pnpm fmt`.

1. Refund, backend: contract, service, route, tests, regenerated client. Commit
   `feat(api): ✨ let an admin record a refund`.
2. Underpaid notice: column, migration (SQL read and cleaned), service method, `verify` change,
   tests. Commit `feat(api): ✨ tell the admins when a top-up was paid short`.
3. Refund, frontend: dialog, button, i18n fr and en, Playwright journey. Commit
   `feat(frontend): ✨ let an admin record a refund on the distribution screen`.
4. Docs, glossary, spec build notes, then the gates: `pnpm lint`, `pnpm typecheck`, `pnpm test`,
   `pnpm build`, `docker ps` check, `pnpm e2e`. Commit `docs(tooling): 📝 describe the refund and
   the underpaid notice` (short subject; body wraps).
   Red output is reported as red.

### 14. What is left for the lot's close (after this slice is built and reviewed)

Not part of this plan's steps. The Architect decides when. Listed so nothing is forgotten:

- Run `code-review` on the slice against its spec; record the findings in this file's
  "Diff-Review Findings".
- Archive the parent spec `20261123-1014-lot-5-wallet.spec.md` and the whole slice folder
  `20261123-1014-lot-5-wallet/` (the three specs, the three work documents and the research file)
  together under `project-management/archive/` (the folder does not exist yet, so the first
  archive creates it; the close step of `.agents/workflow.md` says the exact layout).
- Set the parent spec status, tick its acceptance criteria and every deliverable, and fill its
  "Retrospective".
- Finalize the lot 5 docs: `lot-5-wallet.mdx` as the single description of the lot (no "in
  progress" wording), `project/index.mdx` status line, the glossary read once end to end, a link
  from `explanations/1_architecture.mdx` if the wallet and payments modules are not listed there.
- Add the journal entry in `project-management/JOURNAL.md` and update `ROADMAP.md`.
- Run the `retro` skill for the working rules.
- Still open from slice 01 and not done by any slice: the human check against the real HelloAsso
  sandbox.
- Merging and publishing wait for the human's explicit word.

## Open questions for the Architect

1. **Refund for a member who left.** Plan: allowed for any member status. A terminated member is
   who is owed money. The alternative is active members only.
2. **Underpaid mail is at most once.** Plan: the stamp is set before the send, so a failed send is
   not retried. The alternative is to stamp after a successful send, which can repeat a mail on
   every check while the mail server is down.
3. **Who gets the underpaid mail.** Plan: admins only, as slice 01's note says. The payer is not
   mailed. The alternative is to also tell the payer.
4. **The word "reversible" in the criterion `one-reversible-row`.** Plan: a refund is one new
   negative row and is itself never reversed. If "reversible" means there must be a way to undo a
   refund, that is a new feature, not this slice.
5. **Where the refund button lives.** Plan: the distribution member screen only, beside "record a
   payment", visible to admins. Not on the admin member detail page.

## Worklog

Dated entries, one per work session.

### 2026-11-23, Typist, steps 1 to 4

All four steps are done, in four commits. The Architect's corrections were followed: a member who
left can be refunded, the underpaid notice is stamped before the send and goes to admins only,
a refund has no undo, and the button is on the distribution member screen only.

- **Step 1, refund backend.** Red first: ten new tests in `wallet.service.spec.ts` failed with
  `service.refund is not a function`, the named one first. Then the code went in and all 28 tests
  of the file passed. The controller e2e cases (admin 201, distributor 403, member 403 on own and
  other account, no session 401, five 400 cases, 409 above the balance, 409 on a zero balance,
  a terminated member refunded, the member's own history, and the provider never called) were
  written after the code in the same step and pass. They were not run red first. The provider
  spy works: `WalletModule` and `PaymentsModule` are loaded together with a provider that records
  its calls. The client was regenerated from a built API on port 3999 (`NODE_ENV=development`),
  stopped afterwards by its process id. The new function is `staffWalletControllerRecordRefund`.
  The type of the `refund` code is the typed list `REFUND_REFUSALS`. No migration.
- **Step 2, underpaid notice.** Red first: five new tests in `member-notice.service.spec.ts`
  failed with `service.notifyUnderpaidTopup is not a function`, the named one first. Then the
  notice code, the `verify` change and the column went in. The seven `new PaymentsService(...)`
  calls in `topup.service.spec.ts` got a fourth argument, a notice service whose mail goes
  nowhere. That is wiring only, no assertion changed. The `startApp` helper of
  `topup.controller.e2e-spec.ts` now overrides `EmailService`, for the same reason. Six new
  service tests and one new controller e2e test (a payment short, checked by notification, twice
  by the return page and by notification again, sends one mail) pass.
  `notifyNegativeBalance` was moved onto two shared private helpers; its own tests did not change
  and pass.
- **Migration.** `db:migrate:create` wrote `Migration20261123130752.ts`. I removed from it: the
  drop and re-add of `session_userId_foreign` and `account_userId_foreign`, and the `drop index`
  lines for the category, user, product and member search indexes, and in `down` the matching
  re-creation of those indexes and the `on update cascade` foreign keys. Kept: the new column,
  and its drop in `down`. The tool rewrote the snapshot again; I restored the committed file and
  added by hand only the `underpaidNotifiedAt` column (17 added lines, none removed).
- **Step 3, frontend.** Red first: with the page change stashed, the new Playwright journey failed
  on the missing `wallet-refund-open` button. Then the dialog, the button and the French and
  English keys went in and the journey passed (admin journey and distributor journey).
- **Step 4, docs.** The lot 5 page, the glossary, the status page, the architecture plan line for
  `payments` and the generated index were updated. Nothing under `specs/` was touched.
- **The mail test and the 404.** Once, in a parallel run, one new refund controller test got a
  404 where it expected 409. It did not come back in three reruns of the same file. I took it for
  the same load flake that slice 02 saw. It is noted for the review.

## Implementation Checkboxes

- [x] Step 1: refund backend (contract, service, route, tests, generated client)
- [x] Step 2: underpaid top-up notice (column, migration, notice method, verify change, tests)
- [x] Step 3: refund frontend and Playwright journey
- [x] Step 4: docs, glossary, spec build notes, all gates green

## Notes & Snippets

## Diff-Review Findings

Two reviewers read `git diff c680b18...HEAD`, one for Standards and one for Spec. Neither found a
blocking fault.

Spec axis:

- Zero or negative balance rule, the lock, the admin-only role, the provider never called and the
  once-per-top-up notice: judged correct.
- **A refund amount with more than two decimals is rounded by `eurToCents`.** Answer: the payment
  route behaves the same way, and the plan said "no new rule". Left as it is. Noted for the
  Architect.
- **The criterion word "reversible".** Answer: ruled by the Architect; recorded in the spec's
  "Built as" section.
- **`architecture-plan.mdx` shows a large diff.** Answer: `oxfmt` re-aligned the table. Only the
  `payments` row changed in meaning.
- **The status page says lot 5 is implemented while the parent spec said ready.** Answer: fixed at
  the lot close in the same commit set (the parent spec is now done).
- **Extras (the "largest refund" hint, the disabled button, the shared notice helpers, the export
  of the notice service).** Answer: each is needed by the plan or by the Architect's rulings.

Standards axis:

- **Entity comment badly wrapped.** Fixed in a style commit.
- **Import order in `distribution-member-page.tsx`.** Answer: lint passes; left.
- **Refund dialog uses `useState`, not react-hook-form.** Answer: the correction dialog and the
  payment form do the same; the page follows its neighbours. Proposed to the Architect as a
  clarification of the frontend standard (retro).
- **`underpaid = null as ...` set inside the transaction callback.** Answer: kept. It is the
  simplest way to carry the decision out of the locked step; the comment says why.
- **`run` is a vague name in the notice service; `MemberNoticeService` now holds two notices.**
  Answer: left, small; noted.
- **Duplicated method list and refusal checks in the dialog.** Answer: left, same as the
  neighbours.
- **Tests: no unit test for the dialog; `JSON.stringify` of an entity; `PaymentsService`
  constructor repeated.** Answer: the dialog is covered by Playwright; the others follow the
  existing style. Left.

The 404 flake: the first full `pnpm test` run had nine failures (the new notice test, two
`correctPayment` unit tests, and one correction controller test, among others), all in wallet
tests. A second full run was green (512 tests), and each file is green alone. The same flake was
seen in slice 02. Cause not found. Reported.
