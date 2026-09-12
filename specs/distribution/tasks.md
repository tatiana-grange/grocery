# Tasks: Distribution — Distribution Screen, Express Order, Wallet Debit

**Input**: Design documents from `/specs/distribution/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/distribution-api.md, contracts/wallet-api.md, quickstart.md

**Tests**: Included and required. Principle IV states outright that "money, stock, and
sale-by-weight logic MUST have tests before the feature is considered done", and this lot is
all three. research.md §15 names the specific cases; quickstart.md names the exact spec files
expected. These are not optional.

**E2E tests**: `apps/web-spa-e2e` (Playwright, `pnpm e2e`) is confirmed present. Each user
story below carries a required E2E task, written first and expected to fail before that
story's implementation. The Polish phase runs the full suite. Never edit, skip, or delete an
existing E2E spec to make it pass — stop and ask a human.

**Organization**: Tasks are grouped by user story (spec.md US1–US7) so each can be
implemented and tested independently. Every distribution and staff wallet route is
`@StaffOnly()` — `@Roles('distributor', 'admin')`, research.md §2.

**Naming**: the role is `distributor`. Lots 1–3 reserved it as `grocer` in comments only;
constitution 1.3.0 renamed it. Three code comments still carry the old name and are corrected
in Phase 2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US7, mapping to spec.md's seven user stories
- Every task names its exact file path

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the two new backend modules and two new frontend feature areas every
later task fills in. No business logic here.

- [X] T001 Create the `distribution` module skeleton: empty `distribution.module.ts`,
  `distribution.controller.ts`, `distribution.service.ts`, `distribution.mapper.ts`,
  `distribution.util.ts`, and `entities/`, `contracts/`, `tests/` subfolders under
  `apps/api/src/modules/distribution/`
- [X] T002 [P] Create the `wallet` module skeleton: empty `wallet.module.ts`,
  `wallet.controller.ts`, `wallet.service.ts`, `wallet.mapper.ts`, and `entities/`,
  `contracts/`, `tests/` subfolders under `apps/api/src/modules/wallet/`
- [X] T003 [P] Create the `distribution` frontend feature skeleton:
  `apps/web-spa/app/features/distribution/components/` and `.../utils/` directories
- [X] T004 [P] Create the `wallet` frontend feature skeleton:
  `apps/web-spa/app/features/wallet/components/` and `.../utils/` directories

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The role, the entities, the contracts, the migration, and the shared services
every user story below builds on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### The `distributor` role

- [X] T005 [P] Add `'distributor'` to `USER_ROLES` in
  `apps/api/src/modules/auth/auth.config.ts`, leaving `ADMIN_USER_ROLES` as `['admin']` so the
  role gains no Better Auth admin plugin powers, and correct the stale `grocer` comment on
  line 10 (research.md §2)
- [X] T006 [P] Add `'distributor'` to `USER_ROLES` / `userRoleSchema` in
  `apps/api/src/modules/members/contracts/member.contract.ts` and update its `.meta()`
  description, which still says `grocer` (this one feeds the OpenAPI description, so it must
  land before T024's `pnpm generate`)
- [X] T007 Add `StaffOnly()` = `SetMetadata(ROLES_KEY, ['distributor', 'admin'])` to
  `apps/api/src/modules/auth/auth.decorator.ts` alongside the existing `AdminOnly()`, and
  correct the stale `@Roles('grocer')` comment on line 16. `AuthGuard` needs no change — it
  already reads `ROLES_KEY` generically
- [X] T008 Teach `parseRoles` and `serializeRoles` in
  `apps/api/src/modules/members/members.util.ts` to accept `'distributor'`; both currently
  hard-filter to `member | admin` and would silently drop it (research.md §2)
- [X] T009 [P] Add `'distributor'` to `UserRole` and `parseRoles` in
  `apps/web-spa/app/features/common/lib/roles.ts`, and add `isDistributor` / `isStaff` to
  `useRoles` in `apps/web-spa/app/features/common/hooks/use-session.ts`

### Entities

- [X] T010 [P] Create the `WalletEntry` entity in
  `apps/api/src/modules/wallet/entities/wallet-entry.entity.ts`: `member` FK (not null,
  indexed), signed `amountCents`, `currency`, `reason`, nullable `paymentMethod`, nullable
  `handover` FK, nullable `recordedByUser` FK, nullable `note`, and **`createdAt` only — no
  `updatedAt`** (data-model.md, plan.md Complexity Tracking)
- [X] T011 [P] Create the `Handover` entity in
  `apps/api/src/modules/distribution/entities/handover.entity.ts`: `order` FK, `member` FK,
  `totalAmountCents`, `currency`, `kind`, nullable self-FK `reversesHandover` (indexed),
  `recordedByUser` FK, nullable `note`, `lines` collection, **`createdAt` only**
- [X] T012 [P] Create the `HandoverLine` entity in
  `apps/api/src/modules/distribution/entities/handover-line.entity.ts`: `handover` FK,
  `orderLine` FK, `handedQuantity` as `decimal(10,3)` string (may be `0` or negative),
  `unitPriceAmountCents`, `lineTotalAmountCents`, **`createdAt` only**
- [X] T013 [P] Add the nullable `handoverLine` FK (indexed) to the existing `StockMovement`
  entity in `apps/api/src/modules/inventory/entities/stock-movement.entity.ts`, and update its
  doc comment: lot 4 makes `quantity` genuinely signed

### Contracts

- [X] T014 [P] Widen `STOCK_MOVEMENT_REASONS` to
  `['reception', 'distribution', 'distribution_reversal']` and **relax
  `stockSummarySchema.quantityOnHand` from `z.number().nonnegative()` to `z.number()`** in
  `apps/api/src/modules/inventory/contracts/stock.contract.ts` — negative stock is allowed and
  the old bound would fail response validation (research.md §6)
- [X] T015 [P] Add `'handed_over'` to `ORDER_STATUSES` in
  `apps/api/src/modules/orders/contracts/order.contract.ts` and update its `.meta()`
  description
- [X] T016 [P] Write `apps/api/src/modules/wallet/contracts/wallet.contract.ts`:
  `walletEntryReasonSchema`, `paymentMethodSchema`, `walletEntrySchema`, `walletSchema`,
  `recordPaymentSchema`, each with `.meta()` and an exported inferred type
  (contracts/wallet-api.md)
- [X] T017 [P] Write `apps/api/src/modules/distribution/contracts/handover.contract.ts`:
  `handoverKindSchema`, `handoverLineSchema`, `handoverSchema`, `recordHandoverSchema`,
  `createExpressOrderSchema`, `reverseHandoverSchema` (contracts/distribution-api.md)
- [X] T018 [P] Write
  `apps/api/src/modules/distribution/contracts/distribution-screen.contract.ts`:
  `notReadyReasonCodeSchema`, `distributionMemberSummarySchema`, `distributionLineSchema`,
  `distributionOrderSchema`, `distributionMemberScreenSchema`, `distributionProductSchema`,
  `waitingOrderSchema` + its paginated and filtering schemas

### Shared services

- [X] T019 Implement `WalletService` core in
  `apps/api/src/modules/wallet/wallet.service.ts`: `getBalanceCents(em, memberId)` summing
  `amountCents` in the database (following `InventoryService.getStockLevels`),
  `charge(em, …)` and `credit(em, …)` appending one entry each and taking the caller's
  `EntityManager` so they join its transaction (research.md §3)
- [X] T020 Add `recordIssue(em, …)` and `recordIssueReversal(em, …)` to
  `apps/api/src/modules/inventory/inventory.service.ts`, mirroring the existing
  `recordReceipt`. `recordIssue` writes a negative `quantity` with `unitCostAmountCents` set
  to the product's current weighted average, read **before** the row is appended;
  `recordIssueReversal` copies the original outbound row's unit cost (research.md §5, §9).
  `buildStockLevel` / `inventory.util.ts` are not touched
- [X] T021 [P] Add a unit test in
  `apps/api/src/modules/inventory/tests/inventory.service.spec.ts` proving the §5 property:
  receive the same product at two different unit costs, issue some of it, and assert the
  derived weighted average cost price is unchanged; plus a case asserting a negative stock
  level reads back correctly

### Wiring, schema, client

- [X] T022 Register `WalletModule` and `DistributionModule` in the application module and wire
  their cross-module dependencies (`distribution` imports `wallet` and `inventory`, the same
  way `purchasing` imports `inventory`) in
  `apps/api/src/modules/wallet/wallet.module.ts`,
  `apps/api/src/modules/distribution/distribution.module.ts`, and the app module
- [X] T023 Generate the migration with `pnpm --filter=api db:migrate:create`, **review the
  emitted SQL before applying it**, then `db:migrate:up`. Confirm: `walletEntry`, `handover`,
  `handoverLine` created with the indexes listed in data-model.md;
  `stockMovement.handoverLineId` **added** as a nullable column, not a table rewrite; and
  **no DDL at all** for `order.status`, `stockMovement.reason`, or the roles — all three are
  varchar columns whose values live in contract enums
- [X] T024 Run `pnpm generate` to regenerate `@grocery/openapi-generator` against the new and
  changed contracts (notably the relaxed `quantityOnHand` and the new role value), and confirm
  the frontend type-checks against it

### Frontend shell and E2E fixtures

- [X] T025 Create `apps/web-spa/app/features/common/components/distribution-layout.tsx` gated
  on distributor-or-admin via `useRoles().isStaff`, reusing the `rbac-access-denied` panel
  pattern from `back-office-layout.tsx`, and register the `/distribution` route group in
  `apps/web-spa/app/routes.ts`. Leave `back-office-layout.tsx`'s own `isAdmin` gate untouched
  (research.md §13)
- [X] T026 [P] Add the `distribution` and `wallet` i18n namespaces to
  `apps/web-spa/app/lib/i18n/locales/en/` and `.../fr/` — no hardcoded user-facing strings
  anywhere in this lot
- [X] T027 [P] Add a `distributor` account to `E2E_USERS` and an `E2E_DISTRIBUTION` fixture
  block in `apps/api/src/seeders/e2e.fixtures.ts` (a funded member holding a fulfilled
  pre-order, an in-store order, and a by-weight line; a zero-balance member with a ready
  order; a member with an unreceived pre-order; a terminated member with an order), isolated
  from the lot 2 and lot 3 fixtures the way `E2E_PURCHASING` already is
- [X] T028 Seed those fixtures in the E2E seeder, then add `'distributor'` to the `Role` union
  in `apps/web-spa-e2e/env.ts`, to `withRole` in `apps/web-spa-e2e/fixtures.ts`, and to the
  role loop in `apps/web-spa-e2e/auth.setup.ts` (depends on T027)

**Checkpoint**: Foundation ready — the role exists, the tables exist, the balance and stock
primitives exist, and the `/distribution` shell renders. User stories can now begin.

---

## Phase 3: User Story 1 — Find a member and see what they have to collect (Priority: P1) 🎯 MVP

**Goal**: A staffer finds a member at the table and sees, on one screen, every order still
waiting, which lines are ready, how much is on the shelf, and the member's balance.

**Independent Test**: With a member holding one pre-order covered by a confirmed reception,
one pre-order not yet received, and one in-store order, search for that member and confirm all
three appear, correctly split into ready and not ready, with no handover performed.

### E2E test for User Story 1 ⚠️

> Write this first. It must fail before the implementation below.

- [X] T029 [US1] E2E test in `apps/web-spa-e2e/tests/distribution-screen.spec.ts`: as the
  distributor, find a member by name and again by membership number, see ready and not-ready
  lines distinguished with a reason, see the balance, and see the empty state for a member
  with nothing outstanding

### Implementation for User Story 1

- [X] T030 [P] [US1] Write the pure helpers in
  `apps/api/src/modules/distribution/distribution.util.ts`: `isLineReady(orderLine)` —
  `pre_order` needs `fulfilledAt != null`, `in_store` is always ready — and the not-ready
  reason code (research.md §10)
- [X] T031 [US1] Implement `DistributionService.searchMembers` and `getMemberScreen` in
  `apps/api/src/modules/distribution/distribution.service.ts`: load the member, their
  non-cancelled orders that are not yet handed over with lines and products, the balance via
  `WalletService.getBalanceCents`, and each product's stock on hand via
  `InventoryService.getStockLevels` as the available quantity. A member with nothing
  outstanding returns an empty order list, not a 404
- [X] T032 [US1] Implement the screen mappers in
  `apps/api/src/modules/distribution/distribution.mapper.ts`, handling collections through
  `getItems()` after `isInitialized()`
- [X] T033 [US1] Add `GET /distribution/members` (paginated, `search` filter) and
  `GET /distribution/members/:memberId` to
  `apps/api/src/modules/distribution/distribution.controller.ts`, `@UseGuards(AuthGuard)` +
  `@StaffOnly()`, typed with the Phase 2 schemas
- [X] T034 [P] [US1] Unit tests in
  `apps/api/src/modules/distribution/tests/distribution.service.spec.ts` for readiness
  (pre-order fulfilled vs not, in-store always ready) and the available-quantity mapping
- [X] T035 [P] [US1] API e2e tests in
  `apps/api/src/modules/distribution/tests/distribution.controller.e2e-spec.ts` for both
  routes, including the empty-outstanding case and the 404 for an unknown member
- [X] T036 [P] [US1] Add the TanStack Query options in
  `apps/web-spa/app/features/distribution/utils/distribution-queries.ts` for the search and
  the member screen
- [X] T037 [US1] Build `apps/web-spa/app/features/distribution/components/distribution-home-page.tsx`
  (member search) and `.../distribution-member-page.tsx` (read-only: orders, lines, ready
  badges with their reason, available vs ordered quantity, balance, member status warning),
  with `data-testid` hooks for the E2E spec

**Checkpoint**: User Story 1 is fully functional and independently testable. Staff can see who
is owed what, with nothing yet handed over.

---

## Phase 4: User Story 2 — Hand over an order and charge the member (Priority: P1)

**Goal**: Staff adjust each line to what is actually handed over and validate. In one step the
order is marked handed over, stock drops, and the member is charged.

**Independent Test**: Take a two-line order, reduce one quantity and leave the other, validate,
and confirm the order is handed over, stock fell by exactly what was handed over, the amount
charged matches the adjusted total, and one ledger entry records it.

### E2E test for User Story 2 ⚠️

> Write this first. It must fail before the implementation below.

- [X] T038 [US2] E2E test in `apps/web-spa-e2e/tests/distribution-handover.spec.ts`: adjust a
  quantity, zero a line, weigh a by-weight line, validate, then assert the balance fell by the
  adjusted total, the order shows as handed over, and a second validation is refused

### Implementation for User Story 2

- [X] T039 [P] [US2] Extend `apps/api/src/modules/distribution/distribution.util.ts` with
  `lineTotalCents(handedQuantity, unitPriceAmountCents)`, `handoverTotalCents(lines)`, and
  `isOrderFullySettled(order, handoverLines)` implementing the settlement query from
  data-model.md
- [X] T040 [US2] Implement `DistributionService.recordHandover` in
  `apps/api/src/modules/distribution/distribution.service.ts` as one `em.transactional`,
  in the exact order of data-model.md "Cross-entity rules": lock the `Member` row with
  `LockMode.PESSIMISTIC_WRITE`; refuse unless `order.status === 'pending'` and the caller's
  `version` matches; refuse a line whose product is not ready; compute the total at the order's
  snapshot prices; read the balance and each product's current weighted average cost **before**
  writing anything; refuse with the shortfall if the total exceeds the balance; create the
  `Handover` and its lines; append one negative `StockMovement` per line with
  `handedQuantity > 0`; append one negative `WalletEntry`; set `status = 'handed_over'` if
  every line is settled
- [X] T041 [US2] Add `POST /distribution/orders/:orderId/handovers` to
  `apps/api/src/modules/distribution/distribution.controller.ts`, returning `handoverSchema`.
  Every refusal is a `409` whose body carries an explicit `statusCode` and a `code` from the
  table in contracts/distribution-api.md, so the generated client's `isConflict` helper works
- [X] T042 [P] [US2] Unit tests in
  `apps/api/src/modules/distribution/tests/distribution.service.spec.ts`: the total recomputed
  from adjusted quantities at snapshot prices (not current prices); a by-weight line handed
  over at a weight different from the one ordered; the insufficient-balance comparison
  **including the exact-match boundary** (total equals balance → allowed); the not-ready
  refusal; a zeroed line moving no stock but still settling; order settlement flipping the
  status only when every line is settled (research.md §15)
- [X] T043 [P] [US2] API e2e tests in
  `apps/api/src/modules/distribution/tests/distribution.controller.e2e-spec.ts`: a successful
  handover asserting stock, balance and order status together; the repeat-validation refusal;
  the stale-`version` refusal; the terminated-member refusal; a partial handover leaving the
  rest outstanding
- [X] T044 [P] [US2] Unit tests in
  `apps/api/src/modules/distribution/tests/distribution.mapper.spec.ts` for the handover and
  handover-line mappers, including the read-time `differenceQuantity`
- [X] T045 [US2] Build `apps/web-spa/app/features/distribution/components/handover-form.tsx`:
  per-line quantity or weight input honouring `quantityStepGrams`, a running total, and a
  validate action that sends the loaded `version`; wire it into `distribution-member-page.tsx`
  and surface each `409` code as its translated message

**Checkpoint**: Goods and money move together. User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 — Express order at the table (Priority: P1)

**Goal**: Staff build an order at the table from current stock and validate it in one motion.

**Independent Test**: With a member holding no outstanding order, build an express order of two
products — one found by name, one by barcode — validate, and confirm the order exists, stock
fell, and the account was charged, without touching any pre-existing order.

### E2E test for User Story 3 ⚠️

> Write this first. It must fail before the implementation below.

- [X] T046 [US3] E2E test in `apps/web-spa-e2e/tests/distribution-express.spec.ts`: add a
  product by name and one by barcode, see the over-stock warning without being blocked, remove
  a line, validate, and assert the new order, the stock drop and the charge

### Implementation for User Story 3

- [X] T047 [US3] Implement `DistributionService.listSellableProducts` in
  `apps/api/src/modules/distribution/distribution.service.ts`: non-archived, in-store-orderable
  products searchable by name **or barcode**, each with its current price and current stock on
  hand, reusing `buildSearchFilter` and `InventoryService.getStockLevels`
- [X] T048 [US3] Implement `DistributionService.createExpressOrder` in
  `apps/api/src/modules/distribution/distribution.service.ts` as one `em.transactional`
  that creates the `Order` (`orderingMode: 'in_store'`) and its `OrderLine`s at current prices
  via the existing `currentPrice(product)` helper, then runs the same handover path as T040 —
  same member lock, same balance refusal, same stock and wallet writes (research.md §8)
- [X] T049 [US3] Add `GET /distribution/products` (paginated, `search` / `categoryId` filters)
  and `POST /distribution/members/:memberId/express-orders` to
  `apps/api/src/modules/distribution/distribution.controller.ts`
- [X] T050 [P] [US3] Unit tests in
  `apps/api/src/modules/distribution/tests/distribution.service.spec.ts`: express pricing at
  the current price (including per-kilogram for a by-weight product), the archived or
  non-in-store product refusal, and the empty or all-zero line refusal
- [X] T051 [P] [US3] API e2e tests in
  `apps/api/src/modules/distribution/tests/distribution.controller.e2e-spec.ts`: product search
  by name and by barcode, a successful express sale, and the insufficient-balance refusal on
  the express path
- [X] T052 [US3] Build
  `apps/web-spa/app/features/distribution/components/express-order-form.tsx`: product search
  accepting a scanned or typed barcode, quantity or weight per line, a running total, an
  over-stock warning that does not block, and a single-flight validate action (research.md §11
  — the UI guard is what prevents a double submission)

**Checkpoint**: Both ways of handing goods to a member work. User Stories 1–3 are independent.

---

## Phase 6: User Story 4 — Member account: balance, history, and putting money in (Priority: P1)

**Goal**: Every member has a balance made of visible movements. Members read their own; staff
read it at the table and record money the member hands over, so a refused handover can be paid
and retried.

**Independent Test**: Record a payment into a member's account, check the balance rose by
exactly that amount, hand over an order, and check the balance fell by exactly the charged
total, with both movements in the history with their dates and reasons.

### E2E test for User Story 4 ⚠️

> Write this first. It must fail before the implementation below.

- [X] T053 [US4] E2E test in `apps/web-spa-e2e/tests/distribution-wallet.spec.ts`: validate a
  handover for the zero-balance member and see it refused with the shortfall, record a cash
  payment, validate again successfully, then sign in as that member and see the same balance
  and movements on `/account`

### Implementation for User Story 4

- [X] T054 [US4] Add `recordPayment` and `listEntries` to
  `apps/api/src/modules/wallet/wallet.service.ts`: one positive entry carrying the amount, the
  payment means, the staff user, and an optional note; no lock is needed because a credit can
  never take the balance below zero (data-model.md "Cross-entity rules")
- [X] T055 [P] [US4] Implement `apps/api/src/modules/wallet/wallet.mapper.ts` for
  `walletSchema` and `walletEntrySchema`
- [X] T056 [US4] Implement `apps/api/src/modules/wallet/wallet.controller.ts` with two
  controller classes in one file, per the `catalog.controller.ts` precedent:
  `StaffWalletController` at `wallet` (`@StaffOnly()`) with
  `GET /wallet/members/:memberId` and `POST /wallet/members/:memberId/payments` returning the
  updated wallet; and `MemberWalletController` at `me/wallet` (`@MemberScoped()`) with
  `GET /me/wallet` resolving the caller's own member record only
- [X] T057 [P] [US4] Unit tests in
  `apps/api/src/modules/wallet/tests/wallet.service.spec.ts`: balance as the sum of entries, a
  member with no movements reading `0`, and a credit followed by a charge netting correctly
- [X] T058 [P] [US4] API e2e tests in
  `apps/api/src/modules/wallet/tests/wallet.controller.e2e-spec.ts`: recording each of cash,
  cheque and transfer; the non-positive amount rejection; a member reading their own wallet;
  and a member being refused another member's
- [X] T059 [P] [US4] Add the query options in
  `apps/web-spa/app/features/wallet/utils/wallet-queries.ts`
- [X] T060 [P] [US4] Build `apps/web-spa/app/features/wallet/components/wallet-panel.tsx`
  (balance plus movement history with date, amount and reason) and mount it on
  `apps/web-spa/app/features/account/components/account-page.tsx`
- [X] T061 [US4] Build
  `apps/web-spa/app/features/wallet/components/record-payment-form.tsx` (amount, means, note)
  and
  `apps/web-spa/app/features/distribution/components/insufficient-balance-dialog.tsx`, which
  shows the shortfall from the `409` body, embeds the payment form, and re-validates the same
  handover on success without rebuilding it (FR-028, SC-011)

**Checkpoint**: The money path is complete and usable in a real distribution.

---

## Phase 7: User Story 5 — Work through the waiting lists (Priority: P2)

**Goal**: Staff see what is still to go out, rather than waiting for members to arrive one by
one.

**Independent Test**: With several members holding outstanding orders of both kinds, open each
list, confirm the right orders appear, that a handed-over order leaves the list, and that
opening a row lands on that member's screen.

### E2E test for User Story 5 ⚠️

> Write this first. It must fail before the implementation below.

- [X] T062 [US5] E2E test in `apps/web-spa-e2e/tests/distribution-waiting.spec.ts`: both lists
  populated and kept separate, a date filter narrowing them, opening a row landing on the
  member screen, and a handed-over order having left the list

### Implementation for User Story 5

- [X] T063 [US5] Implement `DistributionService.listWaiting` in
  `apps/api/src/modules/distribution/distribution.service.ts`: paginated orders still
  `pending`, with `orderingMode`, `readyOnly`, `placedFrom` and `placedTo` filters, each row
  carrying its member, total, line count and readiness
- [X] T064 [US5] Add `GET /distribution/waiting` to
  `apps/api/src/modules/distribution/distribution.controller.ts`
- [X] T065 [P] [US5] API e2e tests in
  `apps/api/src/modules/distribution/tests/distribution.controller.e2e-spec.ts` for the
  filters and for a handed-over order dropping out of the list
- [X] T066 [US5] Add the two lists as tabs on
  `apps/web-spa/app/features/distribution/components/distribution-home-page.tsx`, with the date
  filter and rows linking to the member screen

**Checkpoint**: A distribution can be run from the lists rather than reactively.

---

## Phase 8: User Story 6 — Correct a handover validated by mistake (Priority: P2)

**Goal**: Undo a validated handover by recording a correction, leaving the original in the
record exactly as it was.

**Independent Test**: Validate a handover, reverse it, and confirm the balance and stock return
to their expected values while both the original entry and the correcting entry stay
individually visible.

### E2E test for User Story 6 ⚠️

> Write this first. It must fail before the implementation below.

- [X] T067 [US6] E2E test in `apps/web-spa-e2e/tests/distribution-reversal.spec.ts`: reverse a
  handover with a reason, see the balance and stock restored, see both the original charge and
  the credit in the history, and hand the order over again

### Implementation for User Story 6

- [X] T068 [US6] Implement `DistributionService.reverseHandover` in
  `apps/api/src/modules/distribution/distribution.service.ts` as one `em.transactional`:
  create the reversing `Handover` with `kind: 'reversal'`, `reversesHandover` set and
  negative-quantity lines; append positive `StockMovement`s **at the original outbound rows'
  unit costs** via `InventoryService.recordIssueReversal`; append one positive `WalletEntry`
  for exactly the original charge; set the order back to `pending`. Nothing on the original
  handover is written (research.md §9)
- [X] T069 [US6] Add `POST /distribution/handovers/:handoverId/reversal` and
  `GET /distribution/handovers/:handoverId` to
  `apps/api/src/modules/distribution/distribution.controller.ts`, with the `already_reversed`
  and `cannot_reverse_reversal` refusals
- [X] T070 [P] [US6] Unit tests in
  `apps/api/src/modules/distribution/tests/distribution.service.spec.ts`: the reversal
  returning balance **and** the weighted average cost price to their exact prior values, the
  original rows left untouched, and both refusals (research.md §15)
- [X] T071 [P] [US6] API e2e tests in
  `apps/api/src/modules/distribution/tests/distribution.controller.e2e-spec.ts` for the
  reversal, the double-reversal refusal, and the order becoming handable again
- [X] T072 [US6] Build
  `apps/web-spa/app/features/distribution/components/handover-receipt-page.tsx`: the on-screen
  receipt with its lines and total, and a reversal action that requires a reason

**Checkpoint**: Mistakes at the table are recoverable without editing history.

---

## Phase 9: User Story 7 — Restrict the distribution screen to trusted staff (Priority: P2)

**Goal**: A `distributor` can run a distribution and nothing else. Admins keep everything.

**Independent Test**: Give one account the `distributor` role, confirm it completes a handover
and an express order, and confirm the same account is refused on catalogue, purchasing and
member-administration actions.

### E2E test for User Story 7 ⚠️

> Write this first. It must fail before the implementation below.

- [X] T073 [US7] E2E test in `apps/web-spa-e2e/tests/rbac-distributor.spec.ts`: the distributor
  reaches `/distribution` and completes a handover; the distributor is refused on
  `/admin/members`, `/admin/catalog`, `/admin/purchasing` and `/admin/inventory`; a plain member
  is refused on `/distribution`; an admin reaches `/distribution`. Do not modify the existing
  `rbac-admin.spec.ts`

### Implementation for User Story 7

- [X] T074 [P] [US7] API e2e tests in
  `apps/api/src/modules/distribution/tests/distribution.controller.e2e-spec.ts` and
  `apps/api/src/modules/wallet/tests/wallet.controller.e2e-spec.ts` asserting the role boundary
  route by route: a distributor is allowed on every `@StaffOnly()` route and refused on a
  representative `@AdminOnly()` route; a plain member is refused on both
- [X] T075 [P] [US7] Unit tests in
  `apps/api/src/modules/members/tests/` covering `parseRoles` / `serializeRoles` round-tripping
  `member,distributor` and never dropping the new value
- [X] T076 [US7] Surface `distributor` in the admin role editor on
  `apps/web-spa/app/features/admin-members/components/member-detail-page.tsx` so an admin can
  grant and remove it (FR-037), and confirm the existing roles endpoint accepts it now that
  `userRoleSchema` carries the value
- [X] T077 [US7] Add a link from the back-office sidebar in
  `apps/web-spa/app/features/common/components/back-office-layout.tsx` across to
  `/distribution`, and a link back to the shop from the distribution layout

**Checkpoint**: All seven user stories are independently functional.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [ ] T078 [P] Write the lot 4 note at
  `apps/documentation/src/content/docs/project/lot-4-distribution.mdx`, following the shape of
  `lot-3-purchasing.mdx`, and update the "Status" section of
  `apps/documentation/src/content/docs/project/index.mdx`
- [ ] T079 [P] Regenerate the documentation index with
  `pnpm --filter @grocery/documentation generate:index`
- [ ] T080 [P] Confirm the three stale `grocer` comments are gone from
  `apps/api/src/modules/auth/auth.config.ts`,
  `apps/api/src/modules/auth/auth.decorator.ts` and
  `apps/api/src/modules/members/contracts/member.contract.ts`, then grep the repository for
  any remaining `grocer` outside the merged `specs/foundation/`, `specs/shop-orders/` and
  `specs/purchasing/` folders and
  `apps/documentation/src/content/docs/project/monepi-features.mdx`, all of which quote the
  old name deliberately
- [ ] T081 Review the distribution screen against its two speed targets — SC-005 (a five-line
  handover, two quantities adjusted, under 60 seconds) and SC-006 (a three-product express
  sale under 90 seconds): confirm
  `apps/web-spa/app/features/distribution/utils/distribution-queries.ts` fetches the member
  screen in one round trip, and that
  `apps/web-spa/app/features/wallet/components/record-payment-form.tsx` uses the updated
  wallet returned by the payment call instead of refetching
- [ ] T082 Run `pnpm lint` and `pnpm typecheck`, then format **only the files this lot
  touched** — never `pnpm fmt` repo-wide, which rewrites dozens of unrelated files
- [ ] T083 Run `pnpm --filter=api test` and confirm every new unit and controller e2e spec
  passes alongside the existing ones
- [ ] T084 Walk `specs/distribution/quickstart.md` end to end against a freshly seeded local
  stack
- [ ] T085 Run the full `pnpm e2e` suite and confirm every existing Playwright test still
  passes alongside the six new specs. A failing test blocks the feature and needs a human to
  decide whether to update the test or fix the behaviour — never edit or delete an existing
  spec to make it pass

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup. **Blocks every user story.** Within it,
  T023 (migration) depends on the entities T010–T013, and T024 (`pnpm generate`) depends on
  every contract task T006 and T014–T018.
- **User stories (Phases 3–9)**: all depend on Phase 2 only.
- **Polish (Phase 10)**: depends on every story you intend to ship.

### User story dependencies

- **US1 (P1)**: independent. The MVP.
- **US2 (P1)**: independent of US1 at the code level — it adds the write path — but US1's
  screen is where staff reach it, so shipping US2 without US1 has no usable entry point.
- **US3 (P1)**: reuses US2's handover transaction (T040). Build US2 first or duplicate the
  logic; the plan assumes reuse.
- **US4 (P1)**: independent. Its refusal dialog (T061) is only reachable once US2 or US3 can
  produce the refusal, but the wallet screens and payment recording stand alone.
- **US5 (P2)**: independent. Needs only the outstanding-order query.
- **US6 (P2)**: needs a handover to exist, so it follows US2 or US3 in practice.
- **US7 (P2)**: the role itself is Phase 2, so this phase is verification plus the admin UI. It
  can run any time after Foundational.

### Within each user story

- The story's E2E test is written first and must fail before implementation.
- Pure helpers before services, services before controllers, controllers before the frontend.
- A story is not complete while any E2E test fails.

### Parallel opportunities

- Phase 1: T002, T003, T004 alongside T001.
- Phase 2: the two role declarations (T005, T006) together; all four entity tasks
  (T010–T013) together; all five contract tasks (T014–T018) together; then T019 and T020 in
  parallel, with T021 alongside them.
- Within a story: the unit tests, the API e2e tests and the query-options file are all `[P]`
  against each other once the service exists.
- Across stories: after Phase 2, US1, US4, US5 and US7 can run in parallel on separate
  branches or by separate people. US2 → US3 → US6 is the one chain that wants ordering.

---

## Parallel Example: Phase 2 entities and contracts

```bash
# Entities, all different files:
Task: "Create the WalletEntry entity in apps/api/src/modules/wallet/entities/wallet-entry.entity.ts"
Task: "Create the Handover entity in apps/api/src/modules/distribution/entities/handover.entity.ts"
Task: "Create the HandoverLine entity in apps/api/src/modules/distribution/entities/handover-line.entity.ts"
Task: "Add the handoverLine FK to apps/api/src/modules/inventory/entities/stock-movement.entity.ts"

# Contracts, all different files:
Task: "Widen STOCK_MOVEMENT_REASONS and relax quantityOnHand in inventory/contracts/stock.contract.ts"
Task: "Add 'handed_over' to ORDER_STATUSES in orders/contracts/order.contract.ts"
Task: "Write wallet/contracts/wallet.contract.ts"
Task: "Write distribution/contracts/handover.contract.ts"
Task: "Write distribution/contracts/distribution-screen.contract.ts"
```

---

## Implementation Strategy

### MVP first

1. Phase 1 (Setup) → Phase 2 (Foundational).
2. Phase 3 (US1) — staff can find a member and see what is theirs.
3. **Stop and validate**: run `distribution-screen.spec.ts` and the US1 API specs.

US1 alone is a real replacement for the paper list, and it moves no money.

### Incremental delivery

1. Foundation ready.
2. + US1 → the screen. Demo.
3. + US2 → goods and money move. Demo.
4. + US4 → the account can be funded, so the cooperative can actually use it.
5. + US3 → express sales at the table.
6. + US5, US6, US7 → lists, corrections, the role boundary.

Steps 2–4 together are the smallest thing a real distribution can run on: without US4 the
balance can never be topped up, and a refused handover would have no remedy.

### If the lot runs long

US5 (waiting lists) and US6 (reversal) are the two P2 stories that can slip without breaking
the cycle. US7 cannot: the role is what lets volunteers staff the table without admin rights,
and it is largely done in Phase 2 anyway.

---

## Notes

- 85 tasks across 10 phases. US1 9 · US2 8 · US3 7 · US4 9 · US5 5 · US6 6 · US7 5;
  Setup 4, Foundational 24, Polish 8.
- `[P]` means different files and no dependency on an incomplete task.
- Commit after each task or coherent group. Do not push, open a pull request, or merge
  unless asked.
- Money, stock and by-weight logic must have tests before this feature is considered done
  (Principle IV) — research.md §15 is the checklist.
- Never edit, skip or delete an existing E2E spec to make it pass. Stop and ask a human.
- **Still open**: nothing here lets staff correct a mistyped payment (research.md §12). If it
  should be in this lot, it needs a requirement in spec.md first, then a fourth
  `walletEntryReason`, one endpoint, and one test — roughly three tasks in Phase 6.
