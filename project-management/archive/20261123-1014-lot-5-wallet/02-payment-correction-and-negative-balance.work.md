# Payment correction and negative balance — work

Created by the Mason at the plan step, 2026-11-23. Spec:
`project-management/tasks/20261123-1014-lot-5-wallet/02-payment-correction-and-negative-balance.spec.md`.
The parent spec is `project-management/tasks/20261123-1014-lot-5-wallet.spec.md` (its sections
"Seams", "Architecture" and "Implementation Decisions" bind this plan). Slice 01 is in
`01-online-topup.work.md` beside this file.

**Plan:** approved by the Architect, 2026-11-23, with the corrections below. No decision the
human made is departed from.

## Corrections at the reading

Signed Architect, 2026-11-23. Each one overrides the section it names. The human ruled on
points 1 to 3.

1. **The archive stays untouched.** Do not edit anything under `specs/`. Fix only the code, the
   comments, the contract descriptions and the living docs. Drop the archive lines from section 11.
   Write in the living docs page that the old lot 4 files still say the balance is never negative.
2. **No step 8.** The admin notice for an underpaid top-up moves to slice 03. Do not do it here.
   Remove step 8. Add one line to slice 03's spec Notes saying it carries that notice.
3. **The reason stays visible to the member** in their history, like every other note.
4. **Cart scope accepted:** add line, update line and checkout are blocked; reading the cart and
   removing a line stay allowed.
5. **Members and admins with no real e-mail address** get no mail, only a log line.

## Program Design

### 1. Decisions in one place

- A correction is one new ledger row with the reason `payment_correction`. Its amount is the
  original amount with the sign flipped. It points at the original through a new column
  `correctsEntryId`. The original row is never touched.
- Only a row with the reason `payment_received` can be corrected. That covers cash, cheque and
  transfer. Everything else is refused.
- "Corrected once" is enforced by a unique index on `correctsEntryId`. The service also checks
  first, to give a clean error code. The index is the backstop for two staff members clicking at
  the same moment.
- The correction never checks the balance. It can leave the member below zero.
- The balance is still the sum of the rows. Nothing about "blocked" is stored. A member is blocked
  exactly while the sum is below zero, and a top-up or a new payment lifts the block by itself.
- One purchase guard in the wallet module is the only code that decides to refuse a purchase for
  a balance reason. The counter and the online shop both call it (section 4).
- One e-mail per admin and one to the member are sent after the correction has committed. A
  failure to send is logged and never undoes the correction (section 5).
- A correction cannot be corrected, and there is no "undo correction". If staff correct by
  mistake, they record the payment again. This keeps the ledger simple and is stated in the
  docs page.

### 2. Files and interfaces, backend

All under `apps/api/src/modules/wallet/` unless said otherwise.

Changed:

- `contracts/wallet.contract.ts`
  - `WALLET_ENTRY_REASONS` gets `payment_correction`. The reason description is rewritten: "the
    charge and the correction are negative, the others positive".
  - `walletEntrySchema` gets `correctsEntryId` (uuid, nullish: set on a correction row) and
    `correctedByEntryId` (uuid, nullish: set on an original that was corrected).
  - New `correctPaymentSchema`: `{ reason: z.string().trim().min(1).max(500) }`, with
    `.meta()` and an example. New type `CorrectPaymentInput`.
  - New refusal codes, as a const list: `not_a_manual_payment` and `already_corrected`.
  - The `balanceEur` comment and the `walletSchema` description lose "never negative".
- `entities/wallet-entry.entity.ts`: new `correctsEntry` (`ManyToOne` to `WalletEntry`, field
  `correctsEntryId`, nullable, `@Unique()`). The class comment and the comments on `paymentMethod`
  and `note` are updated (a correction carries the original's method and the staff reason).
- `wallet.service.ts`
  - `correctPayment(memberId, entryId, input, staffUserId)` (below).
  - `listEntries` also returns `correctedBy: Map<string, string>` (original id to correction id),
    from one extra query on `correctsEntry in (ids of the page)`. A correction on a newer page
    still shows, because the query is by the ids of this page.
  - The comment on `getBalanceCents` and on `recordPayment` stop claiming "never negative".
- `wallet.mapper.ts`: fills the two new fields from the entry and from the map.
- `wallet.controller.ts`: new route on `StaffWalletController` (class already `@StaffOnly()`):
  `POST wallet/members/:memberId/entries/:entryId/correction`, body `correctPaymentSchema`,
  answers `walletSchema` (201, the updated wallet, like the payment route). It calls
  `PaymentCorrectionService`, not the ledger service directly.
- `wallet.module.ts`: imports `EmailModule`; provides and exports `PurchaseGuard`; provides
  `PaymentCorrectionService` and `MemberNoticeService`.

New:

- `purchase-guard.ts`: the pure rules and the `PurchaseGuard` class (section 4).
- `member-notice.service.ts`: `MemberNoticeService` (section 5).
- `payment-correction.service.ts`: `PaymentCorrectionService`.
- `tests/purchase-guard.spec.ts`, `tests/member-notice.service.spec.ts`; new cases in the existing
  `tests/wallet.service.spec.ts` and `tests/wallet.controller.e2e-spec.ts`.

Signatures:

```ts
// wallet.service.ts
interface CorrectionResult { entry: WalletEntry; balanceAfterCents: number }
correctPayment(
  memberId: string,
  entryId: string,
  input: CorrectPaymentInput,
  staffUserId: string,
): Promise<CorrectionResult>

// payment-correction.service.ts
correct(memberId, entryId, input, staffUserId): Promise<void>
//   1. wallet.correctPayment(...)            (own transaction, commits)
//   2. if balanceAfterCents < 0: notice.notifyNegativeBalance(memberId, balanceAfterCents)
//   never throws because of step 2

// member-notice.service.ts
notifyNegativeBalance(memberId: string, balanceCents: number): Promise<void> // never rejects
```

`correctPayment`, in one `em.transactional`:

1. Load the member (404 `Member not found` if none, as `getMember` does).
2. Load the entry by id and member id. No row: 404 `Entry not found`. This also covers an entry
   that belongs to another member.
3. If `reason !== 'payment_received'`: 409 `not_a_manual_payment`. This covers an online top-up,
   a handover charge, a handover reversal, and a correction itself.
4. If a row with `correctsEntry = entry.id` exists: 409 `already_corrected`.
5. Append the reversing row with `wallet.credit`/`charge`: amount `-entry.amountCents`, reason
   `payment_correction`, `paymentMethod` copied from the original, `note` = the reason,
   `recordedByUser` = the staff member, `correctsEntry` = the original.
6. Flush, read the balance inside the transaction, return it.
7. A `UniqueConstraintViolationException` on flush becomes 409 `already_corrected`.

The write and the balance read run in the same transaction, as Principle II asks. The member row is not locked: a correction has no balance rule to protect, and
a handover that lands at the same moment simply sees the balance before or after, both legal.

Refusals use the same shape as the distribution module (`ConflictException` with `statusCode`,
`message`, `code`), so the generated client and `apiErrorCode` read them the same way.

### 3. Who may call what

| Route                                                  | Who                       | Refused with                          |
| ------------------------------------------------------ | ------------------------- | ------------------------------------- |
| `POST wallet/members/:id/entries/:entryId/correction`  | distributor, admin        | 401 no session; 403 member or pending |
| `GET wallet/members/:id`, `POST .../payments` (as now) | distributor, admin        | unchanged                             |
| `GET me/wallet` (as now)                               | the member, own data only | unchanged                             |

A member has no route that takes another member's id, so "a member cannot correct someone else's
account" is the same 403. The controller e2e test proves it with a member session.

### 4. The single purchase guard

File `purchase-guard.ts`. The rule lives in two small pure functions, so one definition serves
every caller:

```ts
export function isBlocked(balanceCents: number): boolean // balanceCents < 0
export function balanceCovers(totalCents: number, balanceCents: number): boolean
//   totalCents <= balanceCents. Moved here from distribution.util.ts, with its tests.

@Injectable()
export class PurchaseGuard {
  constructor(private readonly wallet: WalletService) {}

  /** Counter. Reads the balance, refuses, and returns the balance so the caller reuses it. */
  assertCounterPurchase(em: EntityManager, memberId: string, totalCents: number): Promise<number>
  //   refuses when isBlocked(balance) or !balanceCovers(total, balance):
  //   409 insufficient_balance { shortfallEur, balanceEur, totalEur }
  //   shortfall = total - balance, so it includes what a negative balance owes.

  /** Online. Only a negative balance blocks. Exactly zero passes. */
  assertOnlinePurchase(em: EntityManager, memberId: string): Promise<void>
  //   409 negative_balance { balanceEur }
}
```

Where it is called:

- Counter handover: `DistributionService.recordHandover` replaces its own balance read and
  `balanceCovers` check with `assertCounterPurchase` (same place, same lock on the member row,
  same code, same fields).
- Express order: `DistributionService.createExpressOrder` does the same.
- Online cart: `CartService.addLine` and `CartService.updateLine` call `assertOnlinePurchase`
  before writing. Reading the cart and removing a line stay allowed, so the member can still see
  the page and tidy the cart.
- Online checkout: `OrdersService.checkout` calls it inside its transaction, after the member is
  loaded and before the cart is read.
- `OrdersModule` imports `WalletModule`. `WalletModule` does not import `OrdersModule`, so there
  is no cycle.

Why the online check takes no lock: checkout charges nothing. It only creates an order. The
counter checks again, under the member lock, when the goods are handed over, so a correction that
lands between the two cannot let a purchase through.

Top-up is never behind the guard (slice 01 already proves a negative balance can top up).

A top-up or a payment that brings the sum back to zero or above lifts the block with no other
action. This is why there is no stored "blocked" flag.

### 5. E-mail

- Reuse `EmailModule` and `EmailService.sendEmail({ to, subject, content, html })`. No new
  transport, no new setting.
- `MemberNoticeService` (constructor: `EntityManager`, `EmailService`):
  - Finds the admins: users whose roles (through `parseRoles`) include `admin`, not banned, with a
    real address (not ending in `@phone.grocery.local`). Unverified addresses count, as in
    `MembersService.send`.
  - Sends one mail per admin and one to the member, with `Promise.allSettled`. Each failure is
    logged with the member id and the recipient role (admin or member), never the address in the
    clear beyond what `EmailService` already logs. One failure never stops the others.
  - A member with no real address (phone-only) gets no mail. A log line says so.
  - The whole method is wrapped in try/catch and never rejects.
- Once per correction: the mail is sent by `PaymentCorrectionService.correct`, only after a
  successful `correctPayment`, and only when the balance after is below zero. A correction can
  happen once per payment (unique index), so the mail can happen once. A refused correction sends
  nothing. Nothing is stored for the mail. If the process dies between the commit and the send,
  the mail is lost. The spec accepts this ("the correction stays, the failure is logged").
- Copy, French first (no English copy: the rest of the member text is French, with i18n on the
  web side only):
  - Member: subject `Un problème sur votre compte`. Body says there is a problem with the
    account, that purchases are paused, and that they can top up their account or contact the
    cooperative. No amount, no mention of a correction, no staff name.
  - Admin: subject `Solde négatif : {member name}`. Body names the member and the membership
    number and gives the balance. It does not say who corrected or why (the ledger has it).
  - Plain text in `content`, plus a short matching `html`.
- Unit tests use a fake `EmailService`. The controller e2e overrides `EmailService` the way
  `members.controller.e2e-spec.ts` already does.

### 6. The extra admin notice for slice 01's underpaid top-up

Not included in the plan. Reason: it must be sent once, and a top-up is checked many times (the
return page and every notification). Today nothing remembers that a top-up was underpaid, so a
mail would repeat on every check. Doing it right needs one new nullable column on `topup` (the
time the admins were told), one migration, an atomic "set if empty" update, one method on the
notice service and about four tests. That is a small step of its own, about 60 lines and one
migration. It does not touch an acceptance criterion. I list it as an optional last step
(step 8) that I will only do if the Architect says yes.

### 7. Schema and migration

One column on `walletEntry`:

| Column            | Type                            | Notes                                          |
| ----------------- | ------------------------------- | ---------------------------------------------- |
| `correctsEntryId` | uuid, null, FK to `walletEntry` | unique; set only on a `payment_correction` row |

Steps:

1. Change the entity. Run `pnpm --filter=api db:migrate:create`.
2. Read the generated SQL before anything else. Keep only: `add column "correctsEntryId"`, the
   unique constraint, the foreign key. Remove every `drop index` line and every rewrite of an auth
   foreign key. Write in the worklog what was removed.
3. Check the snapshot diff in `.snapshot-grocery.json`. Slice 01's snapshot diff was large. Keep
   only the lines for the new column. If the tool reformatted the file, restore the unrelated
   parts by hand.
4. The `down` method drops the foreign key, the constraint and the column in that order.
5. The dev database lags (apply the delta by hand, see the notes on dev database migrations). The
   E2E stack builds from the schema, so it needs no migration run.

No change to the `reason` column type: it is a plain string, and the allowed values live in the
contract (Principle I).

### 8. Frontend

Everything under `apps/web-spa/app/features/wallet/` unless said otherwise. All texts go in
`apps/web-spa/app/lib/i18n/locales/fr/common.locales.fr.json` and the `en` twin. Both files get
every key, in the same commit.

Staff correction:

- `components/correct-payment-dialog.tsx` (one export): a Dialog opened from a ledger row. Shows
  the payment (date, amount, method), a required reason field, a confirm button that is disabled
  while the reason is empty, a cancel button. On success: toast, update the staff wallet cache
  with the answer, invalidate `['distribution']` and `['wallet']`, close.
- `components/wallet-panel.tsx`: new optional prop `onCorrect?: (entry) => void`. A "Corriger"
  button shows on a row only when `onCorrect` is given, the reason is `payment_received` and
  `correctedByEntryId` is empty. A corrected original gets a "Corrigé" badge. A
  `payment_correction` row gets its own label (the reason is visible to the member, like every
  note today). A negative balance is shown in the destructive colour. The member's own pages
  never pass `onCorrect`.
- `utils/wallet-queries.ts`: `correctPayment(memberId, entryId, body)` over the generated
  `staffWalletControllerCorrectPayment` (name to be confirmed after generation).
- `features/distribution/components/distribution-member-page.tsx`: passes `onCorrect` to the panel
  and shows a short notice under the balance when it is below zero ("Solde négatif : aucune remise
  ni commande express tant que le compte n'est pas rechargé"). The refusals at the counter use
  the existing `insufficient_balance` dialog and the existing express refusal text.

Blocked member message:

- `components/negative-balance-notice.tsx` (one export): the sentence "Votre solde est négatif.
  Rechargez votre compte ou contactez la coopérative pour pouvoir commander.", test id
  `negative-balance-notice`.
- Shown on the cart page (balance from `ownWalletQueryOptions`, with the checkout button
  disabled) and on the account page above the top-up form.
- The cart mutation hook `features/cart/hooks/use-cart-mutation.ts` and the checkout mutation in
  `cart-page.tsx` map the code `negative_balance` (read with `apiErrorCode`) to the same text as
  a toast, instead of the generic conflict text. This covers the case where the page was loaded
  before the correction.
- New i18n keys: `wallet.correct.*` (open, title, reason, confirm, cancel, corrected badge),
  `wallet.reason.payment_correction`, `wallet.negative.*` (the member sentence, the staff
  sentence), and the cart toast.

Generated client: regenerate with the same procedure as slice 01 (its work document, section
"Generated client"; the throwaway API on a spare port; the memory note on that). Commit the
client in the step that adds the route.

### 9. Test order per step (the first failing test is named)

The Typist shows each named test red before writing the code, and says so in the worklog. A step
with no red test is reported, not ticked.

| Step | First failing test (file: test name)                                                                                                   |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `wallet.service.spec.ts`: "correctPayment writes a reversing entry of the same amount that points at the original"                     |
| 2    | `purchase-guard.spec.ts`: "refuses a negative balance at the counter with insufficient_balance and a shortfall that includes the debt" |
| 3    | `orders.controller.e2e-spec.ts`: "refuses checkout with negative_balance when the member balance is below zero"                        |
| 4    | `member-notice.service.spec.ts`: "sends one mail to each admin and one to the member"                                                  |
| 5    | `wallet-correction.spec.ts` (Playwright): "le personnel corrige un paiement et le solde devient négatif"                               |
| 6    | `wallet-correction.spec.ts`: "l'adhérent au solde négatif ne peut pas commander et voit le message"                                    |

Test lists by step (each line is one test; the first is the named one):

- Step 1, `wallet.service.spec.ts`: reversing entry; original unchanged and still the only row
  pointing nowhere; amount, method and staff user recorded; reason stored as the note; leaves a
  negative balance and still succeeds (returns `balanceAfterCents` below zero); refuses an online
  top-up, a handover charge, a handover reversal, a correction (all `not_a_manual_payment`);
  refuses a second correction of the same payment (`already_corrected`); 404 for an entry of
  another member; two corrections at the same time, one wins and one is `already_corrected`; no
  row is ever updated or deleted (read the original after and compare).
  `wallet.controller.e2e-spec.ts`: distributor 201; admin 201; member 403 on own account and on
  another account; no session 401; blank reason 400; the answer carries `correctedByEntryId` on
  the original and `correctsEntryId` on the correction; the member's own `GET me/wallet` shows
  both.
- Step 2, `purchase-guard.spec.ts`: `isBlocked` at -1, 0, 1 cents; `balanceCovers` cases moved
  from `distribution.service.spec.ts`; guard returns the balance when allowed; exact balance
  equal to total passes; zero balance and zero total passes. `distribution.controller.e2e-spec.ts`
  (new cases, none edited): a handover and an express order for a member below zero are refused
  with `insufficient_balance`, and nothing is written (no handover, no stock movement, no entry).
- Step 3, `orders.controller.e2e-spec.ts`: add line, update line and checkout refused with
  `negative_balance` and nothing written; exactly zero is not blocked; read cart and remove line
  still work below zero; after a top-up credit the same member can add and check out again.
- Step 4: `member-notice.service.spec.ts` (fake mail): one per admin plus one to the member; the
  member mail has no amount and no "correction"; a banned admin and a phone-only address are
  skipped; one failing send does not stop the others and the method does not reject; the failure
  is logged. `wallet.controller.e2e-spec.ts` (mail faked): correction leaving a negative balance
  sends the mails once; a correction leaving a positive balance sends none; a refused second
  correction sends none; a mail that throws still gives 201 and the entry exists.
- Step 5, Playwright: see section 10.
- Step 6, Playwright: see section 10.

### 10. The Playwright journey

New file `apps/web-spa-e2e/tests/wallet-correction.spec.ts`. No existing E2E test, seed, or
helper behaviour is edited. The seed is not changed: the journey builds its own state through the
screens, with Milo Member (balance zero after `resetDb`), so no member is added to the lists other
specs count.

One test, two browser contexts:

1. Distributor context. `resetDb`, `clearMailbox`. Open Milo at the distribution table. Record a
   cash payment of 10. Make an express sale small enough to be covered (for example the honey
   product of `E2E_DISTRIBUTION`, checked against its price when the test is written). The
   balance is now positive.
2. Open the history, press "Corriger" on the 10 payment, type a reason, confirm. The balance
   shown is below zero. The row shows "Corrigé", the correction row is listed, and the "Corriger"
   button is gone from the original.
3. Try another express sale for Milo: the express refusal appears and nothing is sold.
4. Member context (Milo's saved session). Open the cart: the `negative-balance-notice` shows and
   the checkout button is disabled. Add a product through the shop: the toast carries the same
   text. Open the account page: the notice shows and the top-up form is still there.
5. Mail check, with the existing mailbox helper (one exported function added to
   `apps/web-spa-e2e/maildev.ts` to read the latest message for an address, reusing its private
   polling code): the member address and `admin@e2e.local` each got one message, and the member's
   message does not contain the amount.
6. Record a cash payment of 20 for Milo as the distributor: the balance is above zero and the
   cart is open again (notice gone, checkout enabled).

The mail container uses the E2E ports. Before `pnpm e2e` the Typist runs `docker ps` and looks for
another project on 5434, 1093 and 1043. At the time of this plan none was there. If one shows up,
say so and never stop another project's container. Never edit source while `pnpm e2e` runs.

### 11. Every statement that says "never negative", and what changes

Searched with a case-insensitive search for: never negative, never goes negative, below zero,
non-negative, SC-010, FR-027, "can never take the balance".

Code and comments in `apps/`:

1. `wallet/contracts/wallet.contract.ts`: the `balanceEur` comment "Never negative (SC-010)".
   Reworded: it can be negative after a payment correction.
2. `distribution/contracts/distribution-screen.contract.ts`: the balance comment "never negative
   (SC-010)". Same rewording.
3. `wallet/wallet.service.ts`: the `getBalanceCents` comment ("the same member row lock that
   makes the non-negative rule hold"), and the `recordPayment` comment ("a credit can never take
   a balance below zero"). The first is reworded to say the lock protects the counter check. The
   second stays true for a credit and is made precise (it says a credit alone can never lower the
   balance; a correction can, and has its own path).
4. `distribution/distribution.service.ts`: step 6 of the `recordHandover` comment ("refuse with
   the shortfall") is rewritten to say it calls the purchase guard.
5. `web-spa/.../insufficient-balance-dialog.tsx`: "The balance can never go negative, so this is
   the only way forward". Reworded: a negative balance is a reason the dialog also shows.
6. `wallet/entities/wallet-entry.entity.ts`: comments that list which reasons carry a method or
   a handover, updated for the new reason. Not a "never negative" claim, but now wrong.
7. The reason description in `wallet.contract.ts` ("handover_charge is negative; the others are
   positive") is now wrong because the correction is negative. Updated (item above, section 2).

Living documentation in `apps/documentation/`:

8. `project/lot-4-distribution.mdx`, the `distribution` section: "That is what makes 'the balance
   never goes negative' hold when two tills validate at once". Reworded: the lock keeps a
   handover from overdrawing an account; only a correction can take it below zero.
9. `project/lot-5-wallet.mdx`: gets a "Payment correction and negative balance" section, and the
   "Not done yet" line about slice 02 is trimmed.
10. `project/glossary.mdx`: the entry "Negative balance" already says it is possible. Re-read; add
    the exact rule (exactly zero is not blocked).

Archived lot 4 spec in `specs/distribution/` (the archive is read, never extended, so each change
below is an in-place edit of a claim, with one short added sentence "Changed in lot 5: a payment
correction can take the balance below zero"; see the open question on editing the archive):

11. `spec.md`: FR-027 ("so a member balance never goes below zero"), the wallet entity paragraph
    ("never allowed to fall below zero"), and SC-010 ("No member balance ever falls below zero").
12. `data-model.md`: the invariant "SUM(amountCents) for a member is never negative (FR-027,
    SC-010)", and the paragraph "a credit can never take the balance below zero" (still true,
    reworded as in item 3).
13. `contracts/distribution-api.md`: `balanceEur ... // never negative (SC-010)`.
14. `contracts/wallet-api.md`: "It is returned in euros and is never negative (SC-010)."
15. `tasks.md` (the line "no lock is needed because a credit can never take the balance below
    zero") and `research.md` section 4 title "Keeping the balance non-negative under
    concurrency", and `CHANGELOG.md` ("keeping the balance non-negative under concurrency").
    These three describe what was true and decided at the time. Left alone, history, unless the
    Architect says otherwise.

### 12. Acceptance criteria, where each is tested

| Criterion                         | Where                                                                             |
| --------------------------------- | --------------------------------------------------------------------------------- |
| correct-manual-payment            | `wallet.service.spec.ts`, `wallet.controller.e2e-spec.ts`, Playwright step 2      |
| history-untouched                 | `wallet.service.spec.ts` (original compared before and after)                     |
| only-manual-payments              | `wallet.service.spec.ts` (four refusals), controller e2e (409 codes)              |
| any-staff-may-correct             | controller e2e (distributor, admin 201; member 403 own and other; no session 401) |
| reason-recorded                   | `wallet.service.spec.ts`, controller e2e (note and `recordedBy` in the answer)    |
| may-go-negative                   | `wallet.service.spec.ts`, Playwright step 2                                       |
| blocks-the-counter                | `distribution.controller.e2e-spec.ts` (handover and express), Playwright step 3   |
| blocks-the-online-shop            | `orders.controller.e2e-spec.ts` (add, update, checkout), Playwright step 4        |
| notice-emails                     | `member-notice.service.spec.ts`, controller e2e, Playwright step 5                |
| mail-failure-keeps-the-correction | `member-notice.service.spec.ts`, controller e2e (mail throws, 201, entry exists)  |
| old-claims-updated                | section 11, checked with the same search at the end of step 7                     |
| journey-covered                   | `wallet-correction.spec.ts`                                                       |
| suite-green                       | step 7                                                                            |

### 13. Final states: why, and every input that can reach them

- **A payment is "already corrected"** (a row exists with `correctsEntry` set to it).
  - Why it is final: the ledger is append-only, so the correction row can never be removed, and
    the unique index refuses a second one. A correction row is itself refused as a target. The
    only way to put money back is a new payment.
  - Every input that can write `correctsEntry`: the one route `POST
wallet/members/:memberId/entries/:entryId/correction`, by a distributor or an admin, through
    `PaymentCorrectionService.correct` and `WalletService.correctPayment`. Nothing else sets it:
    not the member routes, not the top-up code, not the distribution module, not the test seed
    routes, not the E2E seeder, not a migration. The Mason checks this with a search for
    `correctsEntry` in the final diff.
- **"Blocked" is not a state.** It is computed from the sum on each call, so it is never final and
  cannot get stuck.
- **"Mail sent" is not stored.** There is no final state to guard.

### 14. Edge cases

- Balance exactly zero: not blocked, online or at the counter (a zero total is already refused
  by the existing `nothing_handed_over` code).
- A member already below zero gets another correction: allowed, and the mails go out again, for
  that new correction.
- The correction makes the balance exactly zero or above: no mail.
- A member who ended their membership: the correction is still allowed (the ledger does not care
  about status). The mail goes to their address if it is real.
- Page loaded before the correction: the cart or checkout call gets `negative_balance` and the
  toast says why.
- Two staff correct the same payment at once: one wins, the other gets `already_corrected`.
- Wrong member id in the path with a real entry id of someone else: 404, nothing written.
- The correction reason is shown in the member's own history. If the Architect prefers it hidden
  from the member, the mapper can blank `note` for `payment_correction` on `me/wallet` (open question on showing the reason).

## Worklog

Dated entries, one per work session.

### 2026-11-23, Typist, step 1

Step 1 is done in one commit. Step 8 was removed from the Implementation Checkboxes, as the
Corrections at the reading say. One line was added to the Notes of `03-refund.spec.md`.

- **Red first.** I wrote the service tests first, in `wallet.service.spec.ts`. The named test,
  "correctPayment writes a reversing entry of the same amount that points at the original",
  failed with `service.correctPayment is not a function`. All 12 new service tests failed the same
  way. Then the code went in and all 18 tests of the file passed.
- **Controller e2e.** Nine cases were added to `wallet.controller.e2e-spec.ts` (distributor 201,
  admin 201, member 403 on own and other account, no session 401, blank reason 400, second
  correction 409, correction row 409, other member 404, the member's own wallet shows both rows).
  They were written after the code, in the same step, and pass. They were not run red first; the
  plan names only the service test as the first red one.
- **Migration.** `pnpm --filter=api db:migrate:create` wrote `Migration20261123111139.ts`. I
  removed from it: the drop and re-add of `session_userId_foreign` and `account_userId_foreign`
  (the auth foreign key rewrites), the `drop index` lines for the category, user, product and
  member search indexes, and in `down` the matching re-creation of those indexes and the
  `on update cascade` foreign keys. Kept: the new column, the foreign key and the unique
  constraint. `down` drops the foreign key, the constraint and the column.
- **Snapshot.** The tool rewrote the whole `.snapshot-grocery.json` (635 lines added, 374 removed,
  mostly reformatting and the same search index drift). I restored the committed file and added
  by hand only the `correctsEntryId` column, its unique index and its foreign key, then ran
  `oxfmt` on that one file. The diff is 33 added lines and nothing removed.
- **Client.** Regenerated from a built API on port 3999 with `NODE_ENV=development`, stopped
  afterwards by its process id. The new function is `staffWalletControllerCorrectPayment`.
  `client/{index,sdk.gen,types.gen,zod.gen}.ts` are committed. `tmp/openapi.json` is git-ignored.
- **Dev database.** Not touched. Port 5111 belongs to another project, and grocery has no dev
  database there, so there was no delta to apply by hand. The test and E2E databases build from
  the entities.
- **Gates.** `pnpm lint` has only the warnings that were already there, no errors. `pnpm typecheck`
  is green. `pnpm test` is green (api: 26 files, 446 tests; i18n: 15 tests). The first full run
  of `pnpm test`, before the code, also showed one failure in
  `distribution.controller.e2e-spec.ts` (a 404 on `/distribution/waiting`). It did not come back
  in the second red run or in the green run, so I took it for a flake under load.
- **Not in this step.** The mail is not hooked in yet, as the plan says.

### 2026-11-23, Typist, step 2

Step 2 is done in one commit.

- **Red first.** `purchase-guard.spec.ts` was written first. The named test, "refuses a negative
  balance at the counter with insufficient_balance and a shortfall that includes the debt", failed
  because `../purchase-guard` did not exist (the whole file failed to load). Then
  `purchase-guard.ts` was written and the file passed (guard cases, `isBlocked` at -1, 0 and 1
  cents, and the moved `balanceCovers` cases).
- **Moved.** `balanceCovers` left `distribution.util.ts` for `purchase-guard.ts`. Its four test
  cases moved to `purchase-guard.spec.ts`. In `distribution.service.spec.ts` only the import
  changed for the one test that still uses it.
- **Wired.** `recordHandover` and `createExpressOrder` now call `assertCounterPurchase`, in the same
  place, under the same member lock. `WalletModule` provides and exports `PurchaseGuard`;
  `DistributionService` takes it in its constructor. The step 6 comment of `recordHandover` was
  reworded (item 4 of section 11).
- **Distribution e2e.** Two new cases in `distribution.controller.e2e-spec.ts`, none edited: a
  handover and an express order for a member below zero are refused with `insufficient_balance`
  and nothing is written. These two were not red first: the old `balanceCovers` check already
  refused any positive total on a negative balance, so they pass before and after. They are kept
  as proof the behaviour does not change. A small helper `owe` was added to that file to put a
  member below zero.
- **Gates.** `pnpm lint` no errors. `pnpm typecheck` green. `pnpm test` green (api: 27 files, 459
  tests; i18n: 15).

### 2026-11-23, Typist, step 3

Step 3 is done in one commit.

- **Red first.** The six new cases were added to `orders.controller.e2e-spec.ts` first, in a new
  `describe`, with no existing test edited. The named test, "refuses checkout with negative_balance
  when the member balance is below zero", failed with `expected 201 to be 409`. The add line and
  update line cases failed the same way. The other three (read cart and remove line still work,
  exactly zero is not blocked, the member can order again after a top-up) passed before the code,
  as they should: they prove what must not change.
- **Then the code.** `OrdersModule` imports `WalletModule`. `CartService.addLine` and `updateLine`
  call `assertOnlinePurchase` before any write. `OrdersService.checkout` calls it inside its
  transaction, after the member is loaded and before the cart is read. After that all 25 cases of
  the file passed.
- **Client.** Not regenerated. No route and no schema changed: the `negative_balance` refusal is a
  409 body with a `code`, which the OpenAPI document does not describe (the same as
  `insufficient_balance`).
- **Gates.** `pnpm lint` no errors. `pnpm typecheck` green. `pnpm test` green (api: 27 files, 465
  tests; i18n: 15).

### 2026-11-23, Typist, step 4

Step 4 is done in one commit.

- **Red first.** `member-notice.service.spec.ts` was written first. The named test, "sends one mail
  to each admin and one to the member", failed because `../member-notice.service` did not exist
  (the whole file failed to load). After `MemberNoticeService` was written, all 7 cases passed:
  one mail per admin and one to the member; the member mail has no amount and no word
  "correct"; the admin mail names the member, the membership number and the balance; a banned
  admin, a phone-only admin and a distributor are skipped; a phone-only member gets no mail and a
  log line; one failing send does not stop the others, is logged with the member id and the role,
  and the method does not reject; an unknown member does not reject.
- **Hooked in.** `PaymentCorrectionService.correct` calls `notifyNegativeBalance` only when the
  balance after is below zero, after `correctPayment` has committed. `WalletModule` imports
  `EmailModule` and provides `MemberNoticeService`.
- **Controller e2e.** Four cases were added to `wallet.controller.e2e-spec.ts` (mail faked with an
  `EmailService` override added to its `beforeEach`): mails sent once for a negative balance, none
  for a positive balance, none for a refused second correction, and a mail that throws still gives
  201 with the entry saved. They were written in the same step as the code and were not run red
  first; the plan names the unit test as the first red one.
- **Gates.** `pnpm lint` no errors. `pnpm typecheck` green. `pnpm test` green on the second full
  run (api: 28 files, 476 tests; i18n: 15). The first full run had one failure,
  "refuses a second reversal of the same handover" in `distribution.controller.e2e-spec.ts`
  (a 404 instead of a 409). That file passed alone (61 tests) and in the second full run. The same
  kind of intermittent 404 in the same file was seen at the start, before any change of mine, so I
  treat it as an existing flake under load and report it.

### 2026-11-23, Typist, step 5

Step 5 is done in one commit.

- **Before `pnpm e2e`.** I ran `docker ps` and looked for ports 5434, 1093 and 1043. Nothing else
  used them, so I started the disposable stack (`grocery-e2e-db`, `grocery-e2e-maildev`). Other
  projects' containers were not touched. I did not edit source while a run was going.
- **Red first.** `apps/web-spa-e2e/tests/wallet-correction.spec.ts` was written first. The named
  test, "le personnel corrige un paiement et le solde devient négatif", failed at the click on the
  "Corriger" button (`wallet-correct-open` did not exist). The state building before it worked.
  The mail test failed at the same point. Then the dialog, the panel and the page changes went in
  and both passed.
- **What was built.** `correct-payment-dialog.tsx`; `wallet-panel.tsx` takes an optional
  `onCorrect`, shows "Corriger" only on an uncorrected `payment_received` row, a "Corrigé" badge on
  a corrected one, and the balance in the destructive colour when negative; `wallet-queries.ts`
  gets `correctPayment` over `staffWalletControllerCorrectPayment`;
  `distribution-member-page.tsx` passes `onCorrect`, shows the staff notice under the balance
  (`distribution-member-negative-notice`) and the negative balance in the destructive colour.
  i18n keys `wallet.correct.*`, `wallet.reason.payment_correction` and `wallet.negative.staff`
  were added to both `fr` and `en`. `maildev.ts` got one exported function, `readMessagesTo`.
  The comment of `insufficient-balance-dialog.tsx` was reworded (item 5 of section 11).
- **Two tests, not one.** The plan describes one journey with two contexts. I wrote the staff part
  (payment, sale, correction, express refusal) and the mail check as two tests of the same file,
  each building its own state through the screens. The member part is the step 6 test. The mail
  check asserts one mail to the member and one to `admin@e2e.local`, the member subject, and that
  the member mail has no amount.
- **Existing tests.** None edited. A fact the Mason should know: `account.spec.ts` renames Milo
  Member to "Milo Édité" and `resetDb` keeps the auth tables. My first full run failed on that
  (my tests searched for "Milo Member"). They pass alone, so I changed my own file to search for
  "Milo", with a comment saying why. I did not touch `account.spec.ts`.
- **Gates.** `pnpm lint` no errors. `pnpm typecheck` green. `pnpm test` green (api: 28 files, 476
  tests; i18n: 15). `pnpm e2e` green: 120 passed (the first full run had my 2 new tests failing
  for the name reason above; 118 others passed).

### 2026-11-23, Typist, step 6

Step 6 is done in one commit.

- **Ports.** Before `pnpm e2e` I checked `docker ps` again: only the two containers I started
  (`grocery-e2e-db` on 5434, `grocery-e2e-maildev` on 1043 and 1093) used those ports. I did not
  edit source while a run was going.
- **Red first.** The third test of `wallet-correction.spec.ts`, "l'adhérent au solde négatif ne
  peut pas commander et voit le message", was written first and failed: the locale key
  `wallet.negative.member` and the `negative-balance-notice` element did not exist. (The test reads
  the sentence from the French locale file, so the first failure was on the missing key. It would
  have failed on the missing element too.) After the code it passed with the two earlier tests.
- **What was built.** `negative-balance-notice.tsx` (one export, test id `negative-balance-notice`),
  shown on the cart page and above the top-up form on the account page. The checkout button is
  disabled while the balance is below zero. `use-cart-mutation.ts` and the checkout mutation of
  `cart-page.tsx` read the code `negative_balance` with `apiErrorCode` and show the same sentence
  as a toast. The key `wallet.negative.member` was added to `fr` and `en`.
- **The journey.** The member adds a product while the balance is zero (the only way to have a line
  in the cart), staff correct the payment, then the member sees the notice and a disabled checkout,
  a refused add in the shop with the toast, the notice and the top-up form on the account page,
  and after staff record a 20 payment the notice is gone and checkout is enabled again.
- **Gates.** `pnpm lint` no errors. `pnpm typecheck` green. `pnpm test` green (api: 28 files, 476
  tests; i18n: 15). `pnpm e2e` green: 121 passed.

### 2026-11-23, Typist, step 7

Step 7 is done in one commit. This step has no red test: it changes comments and living
documentation only. The check the plan names is the search, below. I report that here and tick the
box for what ran.

- **Search.** I ran a case-insensitive search over `apps`, `packages` and `.cursor` for: never
  negative, never goes negative, never go negative, below zero, non-negative, nonnegative,
  SC-010, FR-027, "can never take the balance", never fall, cannot be negative, overdraw,
  overdraft. Before the step, the claims that were still wrong were: the `balanceEur` comment in
  `distribution-screen.contract.ts`, and the lot 4 page ("the balance never goes negative").
  After the step, every hit is one of: a new comment or test that says a balance can be below
  zero; stock below zero (a different thing, on purpose); `nonnegative()` on prices, quantities
  and counts; or the two `FR-027` mentions in `purchase-guard.ts` and in a test name, which are
  about the covering rule and stay true. The only "never negative" left is the sentence in the
  lot 5 page that says the old archive still says it.
- **Changed.** `distribution-screen.contract.ts` (comment), `lot-4-distribution.mdx` (the lock
  keeps a handover from overdrawing an account; only a correction can go below zero),
  `glossary.mdx` ("Negative balance" gets the exact rule: exactly zero is not blocked, a new
  payment lifts it), `lot-5-wallet.mdx` (new section "Payment correction and negative balance", a
  note that the old lot 4 files under `specs/` still say the balance is never negative, the intro
  and "Not done yet" updated: slice 03 also carries the underpaid top-up admin notice). Earlier
  items of section 11 were done in steps 1 to 5 (items 1, 3, 4, 5, 6, 7).
- **Not done, by correction.** Nothing under `specs/` was touched (items 11 to 15 of section 11).
- **Final-state check.** A search for `correctsEntry` in the code (not tests, not migrations)
  shows only one writer: `WalletService.correctPayment`, reached from the one staff route through
  `PaymentCorrectionService.correct`. The listing code only reads it.
- **INDEX.** No page was added, so `generate:index` was not run.
- **Gates on the whole branch.** `pnpm lint` no errors (existing warnings only). `pnpm typecheck`
  green. `pnpm build` green. `pnpm test` green (api: 28 files, 476 tests; i18n: 15). `pnpm e2e`
  green: 121 passed. `pnpm fmt:check` on the whole repo fails: it reports 88 files that were already unformatted before this work
  (mostly `specs/` and old pages). Of the files this branch changed, only the generated migration
  `Migration20261123111139.ts` is on that list; it has the generator's own style, like the older
  migrations. The files I changed were formatted one by one with `oxfmt`.
- **Cleanup.** I started the E2E stack (`grocery-e2e-db`, `grocery-e2e-maildev`) and stopped it
  with `e2e:down`. No other project's container was touched.
- **Flake seen.** `distribution.controller.e2e-spec.ts` showed an intermittent 404 twice (once
  before any change of mine, once in step 4). It passed alone and on every rerun.

## Implementation Checkboxes

Each step is vertical, test first, and ends in one green commit (`pnpm lint`, `pnpm typecheck`,
`pnpm test` green before each commit). Commit messages follow `CONTRIBUTING.md`:
`type(scope): <gitmoji> description`, type, scope and emoji from `commitlint.config.ts`, a body
that says why with lines of at most 100 characters, no `Co-Authored-By`, no push. Stage with
explicit paths. Format only the changed files, never `pnpm fmt` repo-wide.

- [x] Step 1 — Correct a payment. Write the service tests of section 9 first (red, the named one
      first). Then the entity column, the contract changes, `correctPayment`, the mapper, the
      route, `PaymentCorrectionService` without the mail yet. Create the migration and read its
      SQL (section 7). Regenerate the client. Commit.
- [x] Step 2 — The purchase guard at the counter. Write `purchase-guard.spec.ts` first (red). Move
      `balanceCovers` and its tests (the import in `distribution.service.spec.ts` changes, no test
      body changes). Wire both counter paths. Add the new distribution e2e cases. Commit.
- [x] Step 3 — The purchase guard online. Write the cart and checkout cases first (red). Import
      `WalletModule` in `OrdersModule`, call the guard in `CartService` and `OrdersService`.
      Regenerate the client if the error shape changed. Commit.
- [x] Step 4 — The notice e-mails. Write `member-notice.service.spec.ts` first (red). Then
      `MemberNoticeService`, hook it into `PaymentCorrectionService`, add the controller e2e
      cases. Commit.
- [x] Step 5 — Staff correct a payment on the screen. Write the first part of
      `wallet-correction.spec.ts` first (red). Then the dialog, the panel changes, the page
      notice, the i18n keys in both languages, the mailbox helper. Gate commands including
      `pnpm e2e`. Commit.
- [x] Step 6 — The blocked member sees why. Write the second part of the Playwright test first
      (red). Then `negative-balance-notice.tsx`, the cart and account pages, the toast mapping,
      the i18n keys in both languages. Gate commands including `pnpm e2e`. Commit.
- [x] Step 7 — Old claims and documentation. Update every item of section 11 and the lot 5 page,
      run the same search again and write the result in the worklog. Run `pnpm --filter
@grocery/documentation generate:index` only if a page was added. All five gate commands on
      the whole branch. `pnpm fmt:check`. Commit.

## Notes & Snippets

Working notes go here.

## Diff-Review Findings

Mason, 2026-11-23. Two reviewers (standards and spec), fresh sub-agents, on the diff from the plan
commit to the last step commit. Neither found a blocking defect.

Fixed:

- The correction refusal codes were a bare list. They now have a `z.enum(...).meta()` schema
  beside the list, as the backend guideline asks.
- The new online refusal code `negative_balance` was a bare string in the guard. It now has a
  contract enum (`PURCHASE_REFUSALS` with `insufficient_balance`), and the guard's `refuse` takes
  that type and declares its return type.
- The entry id in the correction route is now checked as a uuid.
- The correction dialog took its toast from the wrong package and wrote the staff wallet cache key
  by hand. It now uses the UI package toast and `staffWalletQueryOptions(memberId).queryKey`.

Answered, not changed:

- `refuse()` written in three services, and the same `balanceEur < 0` test in four front-end
  files: small, each is two or three lines. A shared helper would touch older code outside this
  slice. Noted for the retro.
- E-mail text in French while older API mails are English: the plan and the Architect chose French
  first, the member text of this project is French.
- `PaymentCorrectionService` only delegates and adds one check: kept on purpose. It keeps the
  mail outside the ledger transaction.
- The mail is awaited inside the request. A slow mail server delays the staff answer but cannot
  undo the correction. Accepted. A queue is out of scope.
- The wallet's `correctedBy` plumbing appears in two controllers: it is four lines each.
- The slice 02 spec Notes still asked for the underpaid top-up notice. The Architect moved it to
  slice 03. The Notes now say so.
- Controller tests cover the refused online top-up and handover rows only at the service level:
  the service test is the proof, the route adds no logic.
- The correction takes no member lock, so a handover at the same moment can end below zero
  through it. The spec allows a negative balance after a correction.
- The "failure is logged" part of the mail rule is proven in the unit test only.
