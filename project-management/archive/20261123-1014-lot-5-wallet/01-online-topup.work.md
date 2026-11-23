# Online top-up — work

Created by the Mason at the plan step, 2026-11-23. Spec:
`project-management/tasks/20261123-1014-lot-5-wallet/01-online-topup.spec.md`. The parent spec is
`project-management/tasks/20261123-1014-lot-5-wallet.spec.md` (its sections "Seams", "Architecture"
and "Implementation Decisions" bind this plan). The reasons for HelloAsso are in the ADR
`apps/documentation/src/content/docs/project/decisions/0001-helloasso-and-recorded-refunds.mdx`.

**Plan:** approved by the Architect, 2026-11-23, with the corrections below. No decision the
human made is departed from.

## Corrections at the reading

Signed Architect, 2026-11-23. Each one overrides the section it names.

1. **Research before the HelloAsso class.** Step 5 is blocked until the unverified facts of
   section 1 are looked up in the HelloAsso developer documentation with the `research` skill: the
   field names of the creation answer, the shape of the read answer for a paid payment, the
   notification body, whether return URLs must be https, and whether notifications are signed. The
   findings go in a Markdown file beside this document, named `01-online-topup.research.md`. The
   assumed answers in the plan are then replaced by what the documentation says, and the
   "assumed" marks stay only for what could not be confirmed. If the documentation shows a
   signature on notifications, the Architect rules on using it (section 7) before step 4 closes.
2. **A smaller paid amount credits nothing and is not written off.** In section 8, point c, do not
   mark the top-up `failed` when the provider says it was paid less than requested. Leave its
   status as it is, log an error line with the top-up id, and return the stored top-up. A real
   payment must never be marked as lost by our own code. Adjust the matching service test.
3. **The notification route has no rate limiter to reuse.** The only rate limit in the API is
   inside the Better Auth config. Do not add a new one. The 5-second skip per top-up and the cap
   of 20 top-ups in section 7 are the bound. Say so in the work document's Notes & Snippets.
4. **`fake` and `NODE_ENV`.** The E2E and unit runs use `NODE_ENV=test`, so `fake` is honoured
   there. Add one case to `payments.config.spec.ts` that proves `fake` is honoured under `test`
   and ignored under `production`.
5. **Two choices the spec left open are accepted:** a member who becomes inactive after starting a
   top-up is still credited, and an `expired` top-up may turn into `paid`. Both are in section 8.
   The Architect reports them to the human. They are not in the spec.
6. **The human sandbox check stays open.** It needs real HelloAsso sandbox credentials. The
   Typist leaves it unticked and the close report names it as what is left.

## Program Design

### 1. What is verified and what is not

Facts the plan relies on (from the brief, taken from the HelloAsso developer docs): sandbox
`api.helloasso-sandbox.com/v5`, production `api.helloasso.com/v5`; OAuth2 client credentials at
`/oauth2/token`; `POST /organizations/{organizationSlug}/checkout-intents` with the amount in
cents, `totalAmount` equal to the initial amount plus terms, a required `containsDonation`
boolean, and back, return and error URLs; a redirect URL valid 15 minutes; the result read with
`GET` on the checkout intent id; Order and Payment notifications, retried on failure.

Not verified, so the plan isolates each of them inside the HelloAsso class and lists them as
questions to the Architect (see the report): the exact field names of the creation response, the
shape of the read response that says a payment went through, the shape of the notification body,
whether the return and error URLs must be https, whether notifications are signed.

The design below never depends on those unverified facts outside the HelloAsso class.

### 2. Decisions in one place

- New `payments` module (it is already in the constitution's module list). It owns the provider
  seam, the `Topup` record and the routes. The `wallet` module keeps the ledger.
- The provider is chosen at boot from settings. No settings means a "disabled" provider, and the
  app starts as usual.
- A top-up is credited only by one method, `TopupService.verify(topupId)`. The member's return
  page and the provider notification both end in that method. Nothing else can credit.
- `verify` asks the provider first, outside any database transaction. It then opens a short
  transaction, locks the top-up row, re-reads it, and writes the credit and the "paid" state
  together. A second caller waits on the lock, sees "paid", and writes nothing.
- A unique provider payment id on the top-up and on the ledger entry is the backstop. It makes a
  second credit impossible even if the lock were bypassed.
- The credited amount is always the amount stored on our top-up row. The amount the provider says
  was paid is only checked: it must be at least the requested amount. It is never credited.
- The notification route is public and carries no trust. It does not read the payload to decide
  anything. It only nudges: it asks the provider about our recent unfinished top-ups.
- The return page never trusts its own query string. It shows what the API says after asking the
  provider.
- No e-mail in this slice (e-mails belong to slice 02).

### 3. Environment variables and the off switch

All optional. Added in `apps/api/src/config/env.config.ts`, inside `configValidationSchema`:

| Variable                      | Meaning                             | Default                                                                                                            |
| ----------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `PAYMENT_PROVIDER`            | `helloasso` or `fake`. Optional.    | unset                                                                                                              |
| `HELLOASSO_CLIENT_ID`         | OAuth2 client id                    | unset                                                                                                              |
| `HELLOASSO_CLIENT_SECRET`     | OAuth2 client secret                | unset                                                                                                              |
| `HELLOASSO_ORGANIZATION_SLUG` | the association's slug on HelloAsso | unset                                                                                                              |
| `HELLOASSO_API_URL`           | base URL, with `/v5`                | `https://api.helloasso-sandbox.com/v5` (sandbox by default so a production deploy must name production on purpose) |

Rule, written once as a pure function `resolvePaymentsConfig(env)` in
`apps/api/src/config/payments.config.ts`, unit tested:

- `fake` is honoured only when `NODE_ENV` is not `production`. In production it is ignored and a
  warning is logged.
- `helloasso` (or unset) is enabled only when the client id, the secret and the slug are all
  present. A partial set is "disabled" and logs one warning that names the missing variables. It
  never throws, so the app always boots.
- Result: `config.payments = { provider: 'helloasso' | 'fake' | null, helloasso: {...} | null }`.

Where it is documented:

- `apps/api/.env.example`: a new "Online payments (HelloAsso)" block, every variable present and
  empty, with a comment. Empty strings must count as unset, so the schema treats `''` as
  `undefined` for these five keys. This file is also what the API unit tests load, so tests run
  with payments off unless they override the provider.
- `apps/web-spa-e2e/.env.e2e`: `PAYMENT_PROVIDER=fake`.
- The root `.env.example` and the web-spa `.env.example` do not change: the first is for Docker
  Compose only, and the web app learns whether top-up is on from the API (see the options route).
- The living documentation gets the variables at the close step (a short section of the lot 5
  page).

### 4. Files and interfaces, backend

New module `apps/api/src/modules/payments/`:

```
payments.module.ts
payments.service.ts                 # PaymentsService, one service, methods below
topup.controller.ts                 # MemberTopupController (me/topups), PaymentNotificationController
topup.mapper.ts
contracts/topup.contract.ts
entities/topup.entity.ts
providers/payment-provider.ts       # the seam: interface, result types, injection token
providers/disabled-payment.provider.ts
providers/fake-payment.provider.ts
providers/helloasso-payment.provider.ts
tests/topup.service.spec.ts
tests/helloasso-payment.provider.spec.ts
tests/topup.controller.e2e-spec.ts
```

The service is named `PaymentsService` in `payments.service.ts` (module shape of the constitution:
`feature.service.ts`). Its public methods:

```ts
class PaymentsService {
  getOptions(): TopupOptions // enabled flag and bounds
  startTopup(userId: string, amountEur: number): Promise<Topup>
  getTopup(userId: string, topupId: string): Promise<Topup> // read only, member's own
  verifyTopup(userId: string, topupId: string): Promise<Topup> // member asks; checks ownership
  reconcileRecent(): Promise<void> // used by the notification route
  private verify(topupId: string): Promise<Topup> // the one place that can credit
}
```

`WalletService` changes (small, in `apps/api/src/modules/wallet/`):

- `WalletWriteInput` gets `providerPaymentId?: string`, and `append` stores it.
- `credit` is reused with `reason: 'online_topup'`, `paymentMethod: 'online'`. No new write path.
- No change to `getBalanceCents` or any read.

The payments module imports `WalletModule` (it needs `WalletService`, already exported) and
`MikroOrmModule.forFeature([Topup])`. `AppModule` imports `PaymentsModule`. `WalletModule` does
not import `PaymentsModule`, so there is no cycle.

### 5. The payment provider seam

File `providers/payment-provider.ts`:

```ts
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER')

export interface CreatePaymentRequestInput {
  topupId: string // our id, sent as the provider's own reference when it allows one
  amountCents: number // the requested amount, an integer
  description: string // shown to the payer, for example "Top-up of the account"
  returnUrl: string
  backUrl: string
  errorUrl: string
}

export interface CreatedPaymentRequest {
  providerRequestId: string // the checkout intent id
  redirectUrl: string // where to send the payer
  expiresAt: Date // the provider's validity, 15 minutes after creation
}

export type PaymentResult =
  | { status: 'pending' }
  | { status: 'failed' }
  | { status: 'paid'; providerPaymentId: string; paidAmountCents: number }

export interface PaymentProvider {
  readonly isEnabled: boolean
  createPaymentRequest(input: CreatePaymentRequestInput): Promise<CreatedPaymentRequest>
  getPaymentResult(providerRequestId: string): Promise<PaymentResult>
}
```

Both methods throw `PaymentProviderError` (a plain class in the same file) on a network or
provider failure. The service turns it into a 502 with code `provider_unavailable`.

Implementations:

- `DisabledPaymentProvider`: `isEnabled = false`, both methods throw. Never called, because the
  service checks `isEnabled` first.
- `FakePaymentProvider`: in memory, used by every unit test, controller test and the Playwright
  run. A request starts as `pending`. Test-only controls: `settle(providerRequestId, result)`,
  `lastRequest()`, `reset()`. `createPaymentRequest` returns `redirectUrl = returnUrl` so the
  browser lands straight on our return page, as a real payer would after paying. `paid` results
  may carry a larger `paidAmountCents` to model the voluntary contribution.
- `HelloAssoPaymentProvider`: built from `config.payments.helloasso`. Uses Node's global `fetch`
  with `AbortSignal.timeout(10_000)`. It gets an OAuth2 token with client credentials, keeps it in
  memory until a minute before it expires, and refreshes on a 401 once. It posts the checkout
  intent with `initialAmount = totalAmount = amountCents`, `containsDonation: false`, the three
  URLs and `itemName`. It reads the result with GET on the intent id and maps it to
  `PaymentResult`. All field names that are not verified live only here, in two small private
  mapping functions, so fixing them after the sandbox check touches one file.

`PaymentsModule` provides the token with a factory: `config.payments.provider` picks the class.
Tests override the token with `FakePaymentProvider` (the pattern the test app helper already
supports for providers).

### 6. Schema

New entity `Topup`, table `topup`, in `entities/topup.entity.ts` (UUID primary key with
`gen_random_uuid()`, `createdAt` and `updatedAt`, camelCase columns, as the data rules say):

| Column                   | Type                                       | Notes                                                                               |
| ------------------------ | ------------------------------------------ | ----------------------------------------------------------------------------------- |
| `id`                     | uuid                                       | primary key                                                                         |
| `memberId`               | uuid, FK to `member`                       | indexed                                                                             |
| `amountCents`            | int                                        | the requested amount; check 500 to 20000 in the service, not in SQL                 |
| `currency`               | varchar, default `EUR`                     |                                                                                     |
| `status`                 | varchar                                    | `pending`, `paid`, `failed`, `expired` (enum lives in the contract, not the entity) |
| `providerRequestId`      | varchar, nullable, unique                  | set right after the provider creates the request                                    |
| `redirectUrl`            | text, nullable                             | kept so a page reload can resume; also useful in support                            |
| `expiresAt`              | timestamptz                                | creation time plus 15 minutes (the provider's value once known)                     |
| `providerPaymentId`      | varchar, nullable, unique                  | set only when paid. Postgres allows many nulls in a unique column.                  |
| `walletEntryId`          | uuid, nullable, unique FK to `walletEntry` | links the credit to its top-up                                                      |
| `paidAt`                 | timestamptz, nullable                      |                                                                                     |
| `lastCheckedAt`          | timestamptz, nullable                      | for the notification throttle                                                       |
| `createdAt`, `updatedAt` | timestamptz                                |                                                                                     |

Index on `(status, createdAt)` for the notification sweep.

A top-up is a state record, not a ledger, so its status changes. The ledger rule (Principle II)
still holds because the only ledger write is a new `walletEntry` row.

`WalletEntry` changes:

- New nullable column `providerPaymentId` (varchar) with a unique index. Nulls repeat freely.
- `reason` and `paymentMethod` are already plain varchar columns, so the two new values
  (`online_topup`, `online`) need no SQL. They are added in the contract:
  - `WALLET_ENTRY_REASONS` gets `online_topup` (and its description loses "Lot 5 adds...").
  - `PAYMENT_METHODS` gets `online`. Important: `recordPaymentSchema` must NOT accept `online`,
    or staff could type an online payment by hand. Introduce `MANUAL_PAYMENT_METHODS`
    (`cash`, `cheque`, `transfer`) and use it in `recordPaymentSchema`; `paymentMethodSchema`
    (all four) stays the read type. The existing record-payment test gets one new case that
    shows `online` is refused there. No existing test is edited.
  - `walletEntrySchema` gets `providerPaymentId: z.string().nullish()`, and the mapper fills it.
  - The two wallet doc comments that say "never negative" are left to slice 02, as the parent
    spec says.

Migration steps (two migrations, each reviewed):

1. After writing the `Topup` entity: `pnpm --filter=api db:migrate:create`. Review the SQL by
   eye: one `create table "topup"`, its indexes, its foreign keys. No `drop`. Commit the
   migration and the updated `.snapshot-grocery.json` with the step.
2. After the `WalletEntry` column: `db:migrate:create` again. Review: one
   `alter table "walletEntry" add "providerPaymentId"` and one unique index. No `drop`.
3. Run `db:migrate:up` on the E2E database through `pnpm e2e` (it rebuilds the schema from the
   entities with `schema:fresh`), and on a scratch database once to prove the migrations apply
   to a database that already holds lot 4 data. Not against any shared database.
4. Never use `db:fresh:seed` instead of a migration.

### 7. API contracts and routes

Contracts in `payments/contracts/topup.contract.ts` (all with `.meta()`; enums in the contract):

```ts
TOPUP_STATUSES = ['pending', 'paid', 'failed', 'expired'] as const
TOPUP_MIN_EUR = 5; TOPUP_MAX_EUR = 200; TOPUP_QUICK_AMOUNTS_EUR = [10, 20, 50]

topupOptionsSchema = { enabled: boolean, minAmountEur, maxAmountEur, quickAmountsEur: number[] }
startTopupSchema   = { amountEur: z.number().positive() }
topupSchema        = { id, amountEur, status, redirectUrl: nullish, expiresAt, paidAt: nullish }
notificationAckSchema = { received: true }
```

Routes (member routes use `@MemberScoped()` and the session, like `MemberWalletController`):

| Route                                    | Who           | Does                                                                  | Answers                                                                                       |
| ---------------------------------------- | ------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `GET /me/topups/options`                 | member        | tells the page whether top-up is on, and the bounds and quick amounts | 200 `topupOptionsSchema`. Works when disabled (`enabled: false`). Declared before `:topupId`. |
| `POST /me/topups`                        | active member | start a top-up                                                        | 201 `topupSchema` with `redirectUrl`                                                          |
| `GET /me/topups/:topupId`                | owner         | read the stored state, asks nobody                                    | 200 `topupSchema`; 404 for someone else's or unknown id                                       |
| `POST /me/topups/:topupId/verification`  | owner         | ask the provider and credit if paid                                   | 200 `topupSchema`                                                                             |
| `POST /payments/notifications/helloasso` | public        | provider nudge                                                        | always 200 `{ received: true }` once handled                                                  |

Refusals use the project's pattern (an exception with a `code` field, as `refuse` does in the
distribution service):

- `payments_disabled`: 503 on `POST /me/topups`, `GET /me/topups/:id` is still allowed, and the
  verification route returns 503 too.
- `member_not_active`: 403. `@MemberScoped()` already refuses pending, rejected and terminated
  members, but it lets an admin through whatever their member status. The service therefore
  checks `member.status === 'active'` itself.
- `amount_too_low` and `amount_too_high`: 400, with `minAmountEur` and `maxAmountEur` in the body.
  `amount_invalid`: 400 when there are more than two decimals. The check is in the service, so
  the code is explicit. The Zod schema only checks "positive number".
- `provider_unavailable`: 502 when the provider call fails. On start, the top-up row is saved as
  `failed` first, so nothing pending is left.
- A negative balance is never checked. A member with a negative balance may top up.

The member's own top-up routes take the id from the URL but always filter by the session's
member, so no member can read or verify another member's top-up.

How the return page checks the result: HelloAsso sends the payer to our `returnUrl`
(`{CLIENTS_WEB_APP_URL}/account/topup/return?topup=<our id>`). The `backUrl` and `errorUrl` are
the same page with `&from=back` and `&from=error`. The page ignores `from`. It calls
`POST /me/topups/:id/verification` once on load, then polls `GET /me/topups/:id` every 3 seconds
for up to 2 minutes (the notification may credit in the meantime), and offers a "check again"
button that calls the verification route again. It only trusts the status the API returns.

Provider notification route (`PaymentNotificationController`, `@Public()`, no `AuthGuard`):

- Body schema is a loose object (`z.looseObject({})`), so any payload shape passes validation.
  The global JSON parser in `main.ts` already handles it. No raw body is needed, because we do
  not verify a signature; we verify by asking the provider. `main.ts` does not change.
- It calls `reconcileRecent()`: it loads top-ups with status `pending` created in the last 30
  minutes, limited to 20, whose `lastCheckedAt` is empty or older than 5 seconds, and runs
  `verify` on each. A failure on one is logged and does not stop the others. The route returns
  200 when it finished its pass, and a 500 only on an unexpected error so the provider retries.
- Why not read the payload: its shape is unverified, and a payload that claims a payment is
  never a reason to credit. The cost of the choice is that anyone can make us ask the provider
  about at most 20 recent top-ups every 5 seconds each. That is bounded and harmless.

### 8. Exactly-once credit and locking

`verify(topupId)` in `PaymentsService`:

```
1. topup = find(topupId)  (read)                      -> if status = paid: return it
2. if topup has no providerRequestId: return it       (start never finished)
3. result = provider.getPaymentResult(providerRequestId)   -- outside any transaction
4. em.transactional(tem =>
     a. lock the topup row: findOne(Topup, id, { lockMode: PESSIMISTIC_WRITE })
     b. if status = paid: return it                   -- the other caller already credited
     c. result.status = 'paid':
          if result.paidAmountCents < topup.amountCents: mark failed (amount_mismatch), no credit
          else: entry = wallet.credit(tem, { memberId, amountCents: topup.amountCents,
                   reason: 'online_topup', paymentMethod: 'online',
                   providerPaymentId: result.providerPaymentId })
                topup.status = paid; paidAt; providerPaymentId; walletEntry = entry
     d. result.status = 'failed': status = failed
     e. result.status = 'pending': if now > expiresAt + grace(5 min): status = expired
     f. lastCheckedAt = now; flush)
5. on UniqueConstraintViolationException (the backstop): re-read and return the stored top-up
```

Decisions inside this:

- The member row is not locked. A credit can never take a balance below zero, so there is no
  balance rule to serialise (the same reasoning as `recordPayment`). The lock is on the top-up
  row, which is what two callers fight over.
- `failed` is final. `expired` is not final: if a payer pays at the last second and the provider
  later says paid, the next verification still credits. `paid` is final.
- A member who became inactive between start and payment is still credited. The money has been
  paid; refusing would lose it. The active check is at start only.
- Credit uses the stored `topup.amountCents`, never `paidAmountCents`. A larger paid amount (the
  voluntary contribution) is simply ignored. A smaller one is an anomaly and credits nothing.
- The member's wallet balance is never touched directly; it is the sum of entries as before.

### 9. Frontend

Routes: in `apps/web-spa/app/routes.ts`, inside the `member-area-layout` group, add
`route('account/topup/return', 'features/wallet/components/topup-return-page.tsx')`.

Files in `apps/web-spa/app/features/wallet/`:

- `components/topup-form.tsx`: the form on the account page. Shows nothing when the options
  route says `enabled: false` (no button, no section). Otherwise: an amount field (number, step
  0.01), three quick buttons from `options.quickAmountsEur` that set the field (the member can
  still type any amount), a bounds hint ("From 5 € to 200 €"), the submit button, and inline
  messages for `amount_too_low`, `amount_too_high`, `amount_invalid`, `member_not_active`,
  `payments_disabled`, `provider_unavailable`. On success it sends the browser to the
  `redirectUrl` with `window.location.assign`.
- `components/topup-return-page.tsx`: the return page described in section 7. Four visible
  states: checking, credited (with the fresh balance read from the wallet only after
  `paid`), failed, expired. Failed and expired offer a button back to the account page to start
  again. The balance is never shown while checking, failed or expired.
- `utils/wallet-queries.ts` gets `topupOptionsQueryOptions()`, `startTopup(amountEur)`,
  `verifyTopup(id)`, `topupQueryOptions(id)`, written like the existing functions (the generated
  client plus `unwrap`).
- `account-page.tsx` renders `<TopupForm />` under `<WalletPanel />` (one added line, plus the
  import).
- `wallet-panel.tsx` needs no code change: it already translates `reason` and `method_` by key,
  so only the two new i18n keys are added.
- `features/common/lib/api-error.ts` gets `apiErrorCode(error)` which reads `code` from the error
  body (the generated client's `error` is the response body, and `unwrap` throws it).

Test ids (the E2E guide says `getByTestId` only, named `<feature>-<element>[-<variant>]`):
`wallet-topup-form`, `wallet-topup-amount`, `wallet-topup-quick-10`, `-20`, `-50`,
`wallet-topup-submit`, `wallet-topup-error`, `page-topup-return`, `topup-return-checking`,
`topup-return-credited`, `topup-return-balance`, `topup-return-failed`, `topup-return-expired`,
`topup-return-retry`, `topup-return-check-again`.

i18n: strings go in `apps/web-spa/app/lib/i18n/locales/{fr,en}/common.locales.{fr,en}.json`
under `wallet`. New keys (French, English):

| Key                                       | French                                                                                                                              | English                                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `wallet.reason.online_topup`              | Recharge en ligne                                                                                                                   | Online top-up                                                                                              |
| `wallet.method_.online`                   | En ligne                                                                                                                            | Online                                                                                                     |
| `wallet.topup.title`                      | Recharger mon compte                                                                                                                | Top up my account                                                                                          |
| `wallet.topup.amount`                     | Montant                                                                                                                             | Amount                                                                                                     |
| `wallet.topup.quick`                      | {{value}} €                                                                                                                         | €{{value}}                                                                                                 |
| `wallet.topup.bounds`                     | De {{min}} € à {{max}} €                                                                                                            | From €{{min}} to €{{max}}                                                                                  |
| `wallet.topup.submit`                     | Payer avec HelloAsso                                                                                                                | Pay with HelloAsso                                                                                         |
| `wallet.topup.submitting`                 | Redirection…                                                                                                                        | Redirecting…                                                                                               |
| `wallet.topup.note`                       | Le paiement est sécurisé par HelloAsso. Une contribution volontaire peut vous être proposée : elle n'est pas ajoutée à votre solde. | Payment is handled by HelloAsso. A voluntary contribution may be offered: it is not added to your balance. |
| `wallet.topup.error.amount_too_low`       | Le montant minimum est de {{min}} €.                                                                                                | The minimum amount is €{{min}}.                                                                            |
| `wallet.topup.error.amount_too_high`      | Le montant maximum est de {{max}} €.                                                                                                | The maximum amount is €{{max}}.                                                                            |
| `wallet.topup.error.amount_invalid`       | Saisissez un montant avec au plus deux décimales.                                                                                   | Enter an amount with at most two decimals.                                                                 |
| `wallet.topup.error.member_not_active`    | Seuls les adhérents actifs peuvent recharger.                                                                                       | Only active members can top up.                                                                            |
| `wallet.topup.error.payments_disabled`    | Le paiement en ligne n'est pas disponible.                                                                                          | Online payment is not available.                                                                           |
| `wallet.topup.error.provider_unavailable` | Le service de paiement ne répond pas. Réessayez dans un instant.                                                                    | The payment service is not answering. Try again in a moment.                                               |
| `wallet.topup.return.checking`            | Nous vérifions votre paiement…                                                                                                      | We are checking your payment…                                                                              |
| `wallet.topup.return.credited`            | Votre compte a été crédité de {{amount}}.                                                                                           | Your account was credited {{amount}}.                                                                      |
| `wallet.topup.return.balance`             | Nouveau solde                                                                                                                       | New balance                                                                                                |
| `wallet.topup.return.failed`              | Le paiement n'a pas abouti. Rien n'a été débité de votre solde.                                                                     | The payment did not go through. Nothing was added to your balance.                                         |
| `wallet.topup.return.expired`             | La demande de paiement a expiré.                                                                                                    | The payment request expired.                                                                               |
| `wallet.topup.return.retry`               | Recommencer                                                                                                                         | Start again                                                                                                |
| `wallet.topup.return.checkAgain`          | Vérifier à nouveau                                                                                                                  | Check again                                                                                                |

### 10. Generated client

After the API routes exist (end of step 4), regenerate the OpenAPI client: start the API in
development mode on a spare port with throwaway settings, point
`packages/openapi-generator/.env` `API_URL` at it, run `pnpm generate`, then stop that API by its
process id. Commit `packages/openapi-generator/client/**` with the step that first needs it
(step 6, when the form is written). The public notification route will appear in the client; that
is fine. Test-only routes are mounted only when the E2E flag is set, so they never appear.

### 11. Test order per seam

Each step is red first, then green, then commit.

1. Unit, `config/payments.config.spec.ts`: the settings rule (complete set, partial set, empty
   strings, `fake` in production ignored).
2. Unit, `payments/tests/topup.service.spec.ts`, with `FakePaymentProvider` and a real test
   database where the existing wallet tests do the same: bounds, inactive member, disabled,
   start without a provider failure leaving no pending row, verify paid, verify twice, verify
   with a bigger paid amount, verify with a smaller paid amount, verify failed, verify expired,
   expired then paid, two concurrent verifications.
3. Unit, `payments/tests/helloasso-payment.provider.spec.ts`: with a stubbed `fetch`, checks the
   token request, the token reuse and refresh, the creation body, the mapping of each provider
   answer to `PaymentResult`, and the error mapping. The stubbed answers are taken from the
   sandbox check; until then they are marked "assumed".
4. Controller end-to-end, `payments/tests/topup.controller.e2e-spec.ts` (the shape of
   `wallet.controller.e2e-spec.ts`): every route and every refusal: disabled, pending member,
   rejected member, terminated member, admin whose member is not active, another member's top-up,
   no session, wrong bounds, notification with a junk body, notification with a false claim,
   notification twice, notification before return, return after notification.
5. Playwright, `apps/web-spa-e2e/tests/wallet-topup.spec.ts`, with the fake provider: see the
   mapping below.

Playwright control of the fake provider: the E2E API runs in the same process as a
`FakePaymentProvider`. A new file `apps/api/src/modules/test-seed/test-payments.controller.ts`
(registered in `TestSeedModule`, so it exists only with the E2E flag) adds
`POST /api/test/payments/settle` with `{ providerRequestId?, result }` (the latest request when
no id is given) and `POST /api/test/payments/notify` (calls `reconcileRecent`, like the real
notification). `TestSeedModule` imports `PaymentsModule`. The test file calls them with
Playwright's `request` fixture, the way `reset.ts` calls the reset route. `resetDb` runs before
each test; the seed already gives `member@e2e.local` a zero balance. The `topup` table is
truncated by the reset like every other business table. No existing spec, fixture or seeder is
edited.

### 12. Acceptance criteria, where each is tested

| Criterion of the slice spec  | Where it is tested                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| amount-bounds                | topup.service.spec (4 and 5 euros, 200 and 201, 5.005); topup.controller.e2e-spec (codes and bounds in the body); Playwright (a 3 euro and a 250 euro attempt show the inline message)                                                                                                                                                               |
| quick-buttons-fill-the-field | Playwright: tap 20, the field reads 20, then type 35 by hand and submit                                                                                                                                                                                                                                                                              |
| active-members-only          | topup.controller.e2e-spec (pending, rejected, terminated, admin with inactive member refused on the route); Playwright (`pending` role sees no top-up form)                                                                                                                                                                                          |
| negative-balance-can-top-up  | topup.service.spec and topup.controller.e2e-spec (member seeded with a charge, balance below zero, start succeeds)                                                                                                                                                                                                                                   |
| credit-after-verification    | topup.service.spec (no credit while the fake says pending; a notification with no provider result credits nothing); topup.controller.e2e-spec (false notification)                                                                                                                                                                                   |
| requested-amount-is-credited | topup.service.spec and topup.controller.e2e-spec (paid 23 for 20 requested, entry is 20)                                                                                                                                                                                                                                                             |
| credited-exactly-once        | topup.service.spec (verify twice, two concurrent); topup.controller.e2e-spec (notification then return, and return then notification, one entry); Playwright (notify then return page: one entry in the history)                                                                                                                                     |
| no-entry-on-failure          | topup.service.spec and topup.controller.e2e-spec (failed, expired, abandoned); Playwright (failed outcome shows the failure, history unchanged, a new top-up can start)                                                                                                                                                                              |
| entry-is-traceable           | topup.controller.e2e-spec (entry has reason `online_topup`, method `online`, the provider payment id); wallet-panel shows the labels in Playwright                                                                                                                                                                                                   |
| result-page                  | Playwright: checking first, then credited with the balance; failed; expired is covered by the service unit test and the controller test (status), not in the browser                                                                                                                                                                                 |
| off-without-settings         | payments.config.spec; topup.controller.e2e-spec (options says disabled, start answers 503 `payments_disabled`); the API boot itself is proved by the unit and controller suites running with the `.env.example` file that has no HelloAsso settings. The hidden button is proved by the options test (the page renders the form only when `enabled`) |
| settings-documented          | A step checkbox with a manual check of `apps/api/.env.example` and `.env.e2e`; the review reads both files                                                                                                                                                                                                                                           |
| migration-reviewed           | The two migrations with their SQL read at the step, the snapshot committed, the client regenerated and committed; `pnpm typecheck` fails if the client drifts                                                                                                                                                                                        |
| journey-covered              | `wallet-topup.spec.ts`                                                                                                                                                                                                                                                                                                                               |
| suite-green                  | The last step runs the five gate commands                                                                                                                                                                                                                                                                                                            |

Note on the hidden button: there is no frontend unit test runner in `apps/web-spa`. The plan
does not add one. The disabled case is covered at the options route. If the Architect wants the
hidden button proved in a browser, it needs a second E2E API run with no provider, which is
heavy (see the question in the report).

### 13. Edge cases and how each is handled

- Expired request: the provider says pending after `expiresAt` plus 5 minutes, so the top-up
  becomes `expired`. The page shows "expired" and offers to start again. A later "paid" from the
  provider still credits (section 8).
- Duplicate notification: the sweep skips top-ups checked in the last 5 seconds, and `verify`
  returns early on `paid`. Two notifications write one entry.
- Notification before the member returns: the sweep verifies and credits. The return page then
  calls verification, sees `paid`, writes nothing, and shows "credited".
- Return before any notification: the return page's verification credits. The later notification
  finds `paid`.
- Amount bounds: 500 to 20000 cents inclusive. Cents are computed with the existing `eurToCents`
  from `catalog.util`. More than two decimals is refused as `amount_invalid` (no silent rounding).
- Inactive member: refused at start with `member_not_active`, also for an admin whose own member
  record is not active. Not re-checked at credit time.
- Negative balance: allowed to start, no check anywhere in this module.
- Payer adds a contribution: credited the requested amount only.
- Provider down at start: row saved as `failed`, 502 `provider_unavailable`, nothing pending.
- Provider down at verification: the row is left unchanged, the route answers 502, the page shows
  "check again". Nothing is credited and nothing is lost.
- Start crashes between saving the row and calling the provider: the row has no
  `providerRequestId`. `verify` returns it untouched. It becomes harmless `pending` rows that no
  sweep selects (the sweep needs a provider id). A later cleanup is not part of this slice.
- Someone else's top-up id: 404, never revealed.
- Two browser tabs on the return page: both call verification, the lock makes one credit.
- A pending member opening `/account`: they already get the "not active" screen, so no form.

## Worklog

Dated entries, one per work session.

### 2026-11-23, Typist, steps 1 to 4

Steps 1 to 4 are done, one commit each, test first. Steps 5 to 8 and the sandbox check are
untouched.

- Step 1: `payments.config.ts` and its spec (including the `fake` under `test` and under
  `production` case of correction 4), the five variables, the module shell, the seam, the disabled
  provider, `GET /me/topups/options`. The fake provider was written here too, not in step 2,
  because the module factory has to return it when the settings say `fake`.
- Step 2: `Topup` entity, contract, mapper, `startTopup`, `POST /me/topups`, first migration.
- Step 3: `verify`, `verifyTopup`, `getTopup`, the two routes, the wallet contract changes
  (`online_topup`, `online`, `MANUAL_PAYMENT_METHODS`, provider payment id), second migration.
  A smaller paid amount leaves the status as it is, logs an error with the top-up id and credits
  nothing (correction 2).
- Step 4: `reconcileRecent` and the public notification route. The route declares no body at all,
  so no payload is read and none can be refused. No change to `main.ts`.
- Both generated migrations also contained drops of the search indexes (the entities do not
  describe them) and, the second time, two rewritten foreign keys. Those lines were removed by
  hand. The snapshot file was rebuilt as the old content plus the new table or column, because the
  generated one would have lost the search indexes.
- The step 2 commit holds the snapshot with the wrong layout (expanded arrays). The step 3 commit
  puts it back to the layout the repository uses, so the net change from before step 2 is only
  added lines.
- The database tests of `topup.service.spec.ts` make their own test database, because the unit
  project has none set up. They use the same helper as the end-to-end setup.
- Left open: the generated client is not regenerated yet (step 6), and the sandbox check.

### 2026-11-23, Typist, step 5

Step 5 is done in one commit, test first (the spec failed with no class, then passed).

- `HelloAssoPaymentProvider` follows the research file, not the assumed facts of section 1. The
  token is asked on the host root at `/oauth2/token`, kept until 60 seconds before it expires, and
  refreshed with a new client-credentials request. A 401 drops the token and retries once.
- The creation body has no terms and no payer, and carries our top-up id in `metadata`. The
  expiry is set to 15 minutes after creation, because the answer has none.
- A read answer with no `order` is pending. An authorized payment is paid. The paid amount is the
  payment `amount`. Whether it holds the voluntary contribution is unknown, and the service only
  needs paid to be at least the requested amount, so both readings are safe.
- The module factory returns this class when the provider is `helloasso`.
- The unverified field names live in `mapCreateAnswer` and `mapReadAnswer`.
- The sandbox check by the human is still open.

### 2026-11-23, Typist, step 6

Step 6 is done in one commit. The Playwright spec was written first and failed (three cases, no
form); it passed after the form was added.

- The client was regenerated as the Notes say, from a built API on port 3999 run with
  `NODE_ENV=development` (the OpenAPI document is not served under `test`). `sdk.gen.ts` changed
  too, so it is committed with the other three files. `tmp/openapi.json` is git-ignored, so it is
  not committed.
- The wallet schemas changed the generated name `PaymentMethod` to `ManualPaymentMethod`, so
  `record-payment-form.tsx` had its import renamed to keep typecheck green.
- Unknown error codes on the form show the existing `error.default` text.
- Test helper `apps/web-spa-e2e/payments.ts` calls the two test-only routes. They are not
  exercised until step 7.
- The E2E compose file could not start the maildev container, because `keepmyrecipe-maildev`
  already holds ports 1035 and 1090. The db container of the stack was used as is. A second
  maildev (`grocery-e2e-maildev-alt`, ports 1036 and 1091) was started by hand, the API was started
  by hand with `EMAIL_PORT=1036`, and `playwright test` ran with `MAILDEV_URL` set. No committed
  file was changed for this. Result: 115 passed.
- One run of `pnpm test` failed once in `topup.controller.e2e-spec.ts` (a verify expected `paid`)
  and passed on the next two runs. Not investigated.

### 2026-11-23, Typist, step 7

Step 7 is done in one commit. The three journeys were written first and failed (no return page);
they passed after the page, the route and the keys were added. Full browser run: 118 passed, same
manual setup as step 6 (own maildev on 1036 and 1091, API started by hand).

- The first verification call on load is made directly, not through a mutation hook. With the hook,
  React's double run in development left the "check again" button disabled for good. The button
  has its own mutation.
- The journeys settle the fake provider, then press "check again" (the page poll only reads the
  stored state, so it cannot credit by itself). The early notification journey starts the top-up
  with the page's own session through the API, then settles, notifies and opens the return page.
- A return address with no `topup` value sends the member to `/account`. The plan did not say
  what to do here.
- If the stored state cannot be read, the page shows the existing `error.default` text with the
  "check again" button.
- `pnpm test` failed once on an unrelated distribution test (a 404 on a member search) and once on
  a top-up controller test in step 6. Each passed on the next run.

- 2026-11-23, review and close (Mason). Two reviewers read the diff since `staging`. Findings and
  answers are in Diff-Review Findings. Two fixes, typed by the Mason as a small retouch because the
  plan was settled: the HelloAsso state mapping and the throttle stamp, plus two French strings.
  Step 8 ran on the whole branch: `pnpm lint` exit 0, `pnpm typecheck` clean, `pnpm test` 425 API
  and 15 i18n tests green, Playwright 118 passed. The literal `pnpm e2e` could not start its mail
  container, because another project's container holds ports 1035 and 1090, so the same
  suite ran against the same disposable database with a mail container on ports 1036 and 1091 and
  an API started by hand. Everything started was stopped by name or id.

## Implementation Checkboxes

Each step is vertical (backend behaviour with its tests, then what the member sees), test first,
and ends in one green commit (`pnpm lint`, `pnpm typecheck`, `pnpm test` green before each
commit). Commit messages follow `CONTRIBUTING.md`: `type(scope): <gitmoji> description`, valid
type, scope and emoji from `commitlint.config.ts`, a body that says why, no push.

- [x] Step 1 — Settings and the off switch. Write `payments.config.spec.ts` first (red). Add the
      five environment variables to `env.config.ts`, `resolvePaymentsConfig`, the commented
      variables in `apps/api/.env.example`, `PAYMENT_PROVIDER=fake` in
      `apps/web-spa-e2e/.env.e2e`. Add the `payments` module shell, the seam file, the disabled
      provider, and `GET /me/topups/options` with its controller test (disabled and enabled
      answers, member only). Gate commands. Commit.
- [x] Step 2 — Start a top-up. Tests first in `topup.service.spec.ts` and
      `topup.controller.e2e-spec.ts`: bounds, active only, negative balance allowed, disabled,
      provider failure. Then the `Topup` entity, the contract, the fake provider, `startTopup`,
      `POST /me/topups`, the module wiring in `AppModule`. Create the first migration, read its
      SQL, commit the snapshot. Gate commands. Commit.
- [x] Step 3 — Verify and credit once. Tests first: paid, twice, concurrent, bigger paid amount,
      smaller paid amount, failed, expired, expired then paid, other member's id, the traceable
      entry fields, `online` refused by the manual payment route. Then the wallet contract
      changes (reason, methods split, provider payment id on the entry and the mapper), the
      second migration (read its SQL, snapshot), `verify`, `verifyTopup`, `getTopup`, and the two
      routes. Gate commands. Commit.
- [x] Step 4 — The provider notification. Tests first: junk body, false claim, repeated, before
      return, after return, the 5-second skip. Then `reconcileRecent` and the public route. No
      change to `main.ts`. Gate commands. Commit.
- [x] Step 5 — The HelloAsso provider. Tests first with a stubbed `fetch`
      (`helloasso-payment.provider.spec.ts`). Then `HelloAssoPaymentProvider` and the module
      factory that selects it. Gate commands. Commit. The answers used in the stub are marked
      "assumed" until the sandbox check.
- [x] Step 6 — The member sees the form. Regenerate the OpenAPI client (section 10) and commit
      it. Add `apiErrorCode`, the query functions, `topup-form.tsx`, the account page line, the
      i18n keys that the form and the panel need (both languages), the two Playwright test-only
      routes in `test-seed`. Write the Playwright cases for quick buttons, typed amount and
      bounds first (red), then make them pass. Gate commands including `pnpm e2e`. Commit.
- [x] Step 7 — The result page. Write the Playwright journeys first: pay and credited, notification
      first then return (one entry), failed then start again, pending member sees no form. Then `topup-return-page.tsx`, the route, the remaining i18n keys. Gate commands
      including `pnpm e2e`. Commit.
- [x] Step 8 — Close-out checks. Run all five gate commands once on the whole branch. Format only
      changed files, with `pnpm fmt:check` (never repo-wide `pnpm fmt`). Check that both
      `.env.example` files and `.env.e2e` list every new variable. Commit any fix.
- [ ] Sandbox check by the human, before the slice closes: with real sandbox credentials, run one
      top-up by hand, confirm the unverified facts of section 1, and fix the HelloAsso class and
      its test answers if they differ. The Typist cannot tick this; it leaves it open.

## Notes & Snippets

- The reference shape is the wallet module: `apps/api/src/modules/wallet/` (service, mapper,
  controllers, `tests/wallet.controller.e2e-spec.ts`), and the transaction and member lock in
  `apps/api/src/modules/distribution/distribution.service.ts` (`recordHandover`).
- The test app helper is `apps/api/src/test/helpers/test-app.helper.ts`. It takes `imports`, and
  it overrides providers given as `{ provide, useValue }`, which is how the fake provider goes in.
- `AuthGuard` (`apps/api/src/modules/auth/auth.guard.ts`) lets admins through `@MemberScoped()`
  without checking their member status. That is why the service checks the status itself.
- `apps/api/src/main.ts` has a raw-body branch only for a Stripe route that no longer exists. It
  is not needed here and is left alone.
- Plain JSON error bodies carry `code`, for example the `refuse` helper of the distribution
  service. The frontend `unwrap` throws that body, so `apiErrorCode` can read it.
- The generated client is committed in `packages/openapi-generator/client/`. Its function names
  follow the controller and method names, so the query functions will use names like
  `memberTopupControllerStart`.

Facts about this repo that cost time before, written here because the repo is the only memory:

- **Test ids in Playwright.** The suite finds rows with `[data-testid^="thing-"]`. A nested
  control named with the same stem also matches. Give inner controls a different stem, for
  example `topup-qty`, not `topup-amount-quantity`.
- **Never edit a source file while `pnpm e2e` runs.** The dev server reloads in the middle of the
  run and an unrelated spec times out, which looks like a regression. If a spec fails after you
  edited during a run, run that spec alone again before treating it as real.
- **Migrations.** `pnpm --filter=api db:migrate:create` diffs the entities against
  `.snapshot-grocery.json`. Commit the new migration file and the updated snapshot together. A local
  development database is built with `schema:fresh`, so `db:migrate:up` on it may fail with "already
  exists". Do not fight it: the E2E run rebuilds its own schema, and a scratch database proves the
  migration.
- **Ports.** `localhost:5111`, the `DATABASE_PORT` of `.env`, may belong to another project's
  Postgres. Before any database work, check `docker ps` for who owns it. For a manual check use the
  disposable E2E stack: `pnpm --filter @grocery/web-spa-e2e e2e:infra`, then `e2e:setup`, API on
  3060 and the app on 5273, `e2e:down` to stop. Stop what you start, by container name.
- **Client generation.** `pnpm generate` reads the OpenAPI document from a running API. Build the
  API with `pnpm --filter=api build`, run `API_PORT=3999 node dist/main.js` in the background,
  run `API_URL=http://localhost:3999/api pnpm generate` inside `packages/openapi-generator`, then
  stop that process by its id. Commit `client/{index,types.gen,zod.gen}.ts` and `tmp/openapi.json`.
  The client does not validate answers at runtime, so a stale API shows up as `undefined` fields.
- **Formatting.** Never run `pnpm fmt` on the whole repo. Format only the files you changed.
- **The notification route and rate limits.** The API has no general rate limiter. The bound on the
  public notification route is the 5-second skip per top-up and the cap of 20 top-ups per pass.

**What the HelloAsso documentation says** (full text in `01-online-topup.research.md`):

- Only partner accounts get a signature on notifications. Ours is not shown to be one, so a
  notification stays a hint and we always confirm by reading the intent with our own token.
- The three return URLs must be https. A real run needs an https address for the web app. Whether
  `localhost` is accepted in the sandbox is not known.
- No `order` in the read answer means the payment is not authorized yet, which we treat as pending.
  The docs show no separate value for a refused or expired intent.
- Our top-up id travels in `metadata` when we create the intent. The read answer returns it.
- The redirect URL is valid for 15 minutes. The docs do not say what happens after that.

## Diff-Review Findings

The findings of `code-review`, judged against the spec document with this file as evidence, each
with its fix or its answer.

Review of the full diff since `staging` (`git merge-base staging HEAD`), 2026-11-23, by two fresh
reviewers (standards, spec). Fixes were typed by the Mason as a small retouch (a few lines each,
the plan was settled), in one commit.

**Standards**

1. Unknown HelloAsso payment state ended in a final `failed`. Real: yes. Fixed: only the states
   Refused, Refunded, Refunding and Contested, all of them, lead to `failed`. Every other state,
   known or new, stays `pending`. Test added for an unknown state.
2. A failing provider was never throttled, because `lastCheckedAt` was written only after an
   answer. Real: yes. Fixed: `reconcileRecent` stamps `lastCheckedAt` on its candidates before it
   asks. Test added (provider down, two nudges, one call).
3. French and English differed on two strings (`failed`, `note`). Real: yes. Fixed: the French now
   says "Rien n'a été ajouté à votre solde" and "géré par HelloAsso".
4. The first verification on the return page swallows its error. Answer: kept on purpose. A failure
   there leaves the "check again" button, which is the visible way out. The comment in the file
   says so.
5. Underpayment stays `pending` and turns `expired`, with an error log only. Answer: this is
   correction 2 of the Architect at the reading. Raised in the close report.
6. Hardcoded English `description` sent to HelloAsso. Answer: kept. It is a bank-statement-like
   label on the provider's page, the payer's own language is not known to the API. Raised as a
   small question in the close report.
7. Smells: two 15-minute constants, the query key `['topup', id]` written in three places, bare
   strings for provider states, `as` casts on provider JSON, `1e-6` in the amount check, no
   `examples` on `topupSchema`. Answer: judgement calls, none changes behaviour. Not changed in
   this slice. The provider JSON casts stay inside the two mapping functions on purpose (see
   Program Design 5).

**Spec**

8. `failed` is final, so a refused card retried inside the same HelloAsso checkout, then
   authorized, would never be credited. Whether HelloAsso allows a retry in one checkout is not in
   the documentation. Answer: the approved plan says `failed` is final. Raised to the Architect
   (question in the close report). The mapping fix of finding 1 already narrows how a top-up can
   become `failed`.
9. The sweep skips `expired` top-ups, so a late payment is credited only when the member opens the
   return page. Answer: as planned in Program Design 7 and 8, the sweep selects `pending` only.
10. A non-active admin sees the form and gets `member_not_active` on submit. Answer: the options
    route does not know the member's status. The route is the guard, as the spec asks ("on the
    page or on the route" is met for pending, rejected and terminated members, who never see the
    account page). Not changed.
11. Expired page is not in a Playwright journey. Answer: planned, covered by service and controller
    tests.
12. Things not in the spec but kept: `amount_invalid`, the 502 code, the 5-minute grace, the
    sweep limits, `PAYMENT_PROVIDER=fake`. Answer: all are in the approved plan. The spec says
    "valid 15 minutes" while the expiry is 20 minutes, and `expired` is not final. The spec is the
    one to update, raised in the close report.
13. No sandbox run yet. Answer: open on purpose, the human step.
14. Flaky unit runs seen by the Typist (two files, once each, green on rerun): four reruns of the
    payments tests alone were green. One full run is repeated at step 8.
