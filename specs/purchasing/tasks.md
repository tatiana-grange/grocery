# Tasks: Purchasing — Aggregate Pre-orders, Receive, Stock, Cost Price

**Input**: Design documents from `/specs/purchasing/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/purchasing-api.md, contracts/inventory-api.md, quickstart.md

**Tests**: Included and required. plan.md's Constitution Check calls out dedicated unit
tests for cost price and discrepancy logic (Principle IV), and quickstart.md names the
exact spec files expected (`purchasing.service.spec.ts`, `purchasing.mapper.spec.ts`,
`inventory.service.spec.ts`, both `*.controller.e2e-spec.ts`) — these are not optional.

**E2E tests**: `apps/web-spa-e2e` (Playwright, `pnpm e2e`) is confirmed present
(research.md §9). Each user story below carries a required E2E task, written first and
expected to fail before that story's implementation. The Polish phase runs the full suite.
Never edit or delete an existing E2E spec to make it pass — stop and ask a human.

**Organization**: Tasks are grouped by user story (spec.md P1–P2) to enable independent
implementation and testing of each. All routes are `@AdminOnly()` (spec Assumptions — the
`grocer` role does not exist until lot 4).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on an incomplete task)
- **[Story]**: US1–US5, mapping to spec.md's five user stories
- Every task names its exact file path

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the two new backend modules and two new frontend feature areas that
every later task fills in. No business logic here.

- [X] T001 Create the `purchasing` module skeleton: empty `purchasing.module.ts`,
  `purchasing.controller.ts`, `purchasing.service.ts`, `purchasing.mapper.ts`, and
  `entities/`, `contracts/`, `tests/` subfolders under
  `apps/api/src/modules/purchasing/`
- [X] T002 [P] Create the `inventory` module skeleton: empty `inventory.module.ts`,
  `inventory.controller.ts`, `inventory.service.ts`, `inventory.mapper.ts`, and
  `entities/`, `contracts/`, `tests/` subfolders under `apps/api/src/modules/inventory/`
- [X] T003 [P] Create the `admin-purchasing` frontend feature skeleton:
  `apps/web-spa/app/features/admin-purchasing/components/` and `.../utils/` directories
- [X] T004 [P] Create the `admin-inventory` frontend feature skeleton:
  `apps/web-spa/app/features/admin-inventory/components/` and `.../utils/` directories

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Entities, contracts, the migration, and module wiring that every user story
below builds on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 [P] Add `supplierOrderLine` (nullable `ManyToOne` → `purchasing.SupplierOrderLine`)
  and `fulfilledAt` (nullable `Date`) fields to the existing `OrderLine` entity in
  `apps/api/src/modules/orders/entities/order-line.entity.ts` (data-model.md "orders
  module (extended)"; no other field on `OrderLine`/`Order` changes)
- [X] T006 [P] Create the `SupplierOrder` entity in
  `apps/api/src/modules/purchasing/entities/supplier-order.entity.ts`: `supplier` FK
  (not null), `status` (`draft`/`sent`/`received`/`closed`, contract-level enum only),
  `sentAt`, `closedAt`, `version` (optimistic lock), `createdAt`/`updatedAt`, `lines`
  OneToMany, `receptions` OneToMany (data-model.md "SupplierOrder")
- [X] T007 [P] Create the `SupplierOrderLine` entity in
  `apps/api/src/modules/purchasing/entities/supplier-order-line.entity.ts`:
  `supplierOrder` FK, `product` FK, `quantity` (decimal(10,3)), `createdAt`/`updatedAt`,
  unique constraint on (`supplierOrder`, `product`), `sourceOrderLines` OneToMany ←
  `orders.OrderLine.supplierOrderLine`, `receptionLines` OneToMany (data-model.md
  "SupplierOrderLine")
- [X] T008 [P] Create the `Reception` entity in
  `apps/api/src/modules/purchasing/entities/reception.entity.ts`: `supplierOrder` FK,
  `receivedAt`, `createdAt` only (no `updatedAt` — immutable, research.md §7), `lines`
  OneToMany (data-model.md "Reception")
- [X] T009 [P] Create the `ReceptionLine` entity in
  `apps/api/src/modules/purchasing/entities/reception-line.entity.ts`: `reception` FK,
  `supplierOrderLine` FK, `receivedQuantity` (decimal(10,3), `>= 0`),
  `unitCostAmountCents` (int, `>= 0`), `currency` (`'EUR'`), `createdAt` only
  (data-model.md "ReceptionLine")
- [X] T010 [P] Create the `StockMovement` entity in
  `apps/api/src/modules/inventory/entities/stock-movement.entity.ts`: `product` FK,
  `quantity` (decimal(10,3), positive in lot 3), `unitCostAmountCents`, `currency`,
  `reason` (contract-level enum, `'reception'` in lot 3), `receptionLine` FK (nullable),
  `createdAt` only — append-only ledger row, Principle II (data-model.md "StockMovement")
- [X] T011 [P] Create `apps/api/src/modules/purchasing/contracts/supplier-order.contract.ts`
  with `supplierOrderStatusSchema`, `discrepancyKindSchema`, `supplierOrderLineSchema`,
  `supplierOrderSchema`, `supplierOrderDetailSchema`, `supplierOrdersListSchema`,
  `sendSupplierOrderSchema`, `closeSupplierOrderSchema`, each with `.meta()` (per
  contracts/purchasing-api.md "Enums", "Aggregation", "Supplier orders")
- [X] T012 [P] Create `apps/api/src/modules/purchasing/contracts/reception.contract.ts`
  with `recordReceptionSchema`, `receptionLineSchema`, `receptionSchema`, each with
  `.meta()` (per contracts/purchasing-api.md "Receptions")
- [X] T013 [P] Create `apps/api/src/modules/inventory/contracts/stock.contract.ts` with
  `stockMovementReasonSchema`, `stockSummarySchema`, `stockListSchema`,
  `stockMovementSchema`, `stockDetailSchema`, each with `.meta()` (per
  contracts/inventory-api.md)
- [X] T014 Generate the MikroORM migration (`pnpm --filter=api db:migrate:create`) covering
  `orderLine.supplierOrderLine`/`fulfilledAt` as nullable columns and the new
  `supplierOrder`, `supplierOrderLine`, `reception`, `receptionLine`, `stockMovement`
  tables in `apps/api/src/modules/db/migrations/`; hand-review it is additive (no
  destructive rewrite of `orderLine`), then run `pnpm --filter=api db:migrate:up`
  (depends on T005–T010; quickstart.md "Moving to migrations")
- [X] T015 Wire `PurchasingModule` in
  `apps/api/src/modules/purchasing/purchasing.module.ts`: `MikroOrmModule.forFeature` for
  `SupplierOrder`, `SupplierOrderLine`, `Reception`, `ReceptionLine`; declare
  `PurchasingService`/`PurchasingMapper` providers; export `PurchasingService` (depends on
  T006–T009)
- [X] T016 [P] Wire `InventoryModule` in
  `apps/api/src/modules/inventory/inventory.module.ts`: `MikroOrmModule.forFeature` for
  `StockMovement`; declare `InventoryService`/`InventoryMapper` providers; export
  `InventoryService` (depends on T010)
- [X] T017 Register `PurchasingModule` and `InventoryModule` in `apps/api/src/app.module.ts`,
  following the existing `CatalogModule`/`OrdersModule` registration pattern (depends on
  T015, T016)
- [X] T018 Implement `InventoryService.recordReceipt(receptionLine)` (creates one
  `StockMovement` row) plus `getStockSummary(productId)` and `getStockList(filters)`,
  deriving `quantityOnHand` (`SUM(quantity)`) and `costPriceEur` (`SUM(quantity *
  unitCostAmountCents) / SUM(quantity)`, `null` when no movements) purely by aggregate
  query — never stored on `Product` — in
  `apps/api/src/modules/inventory/inventory.service.ts` (research.md §4; depends on T016)
- [X] T019 [P] Unit tests for `InventoryService` in
  `apps/api/src/modules/inventory/tests/inventory.service.spec.ts`: stock-level sum,
  weighted-average-cost aggregate across multiple movements at different unit costs, and
  the "no movements → `0` / `null`" case (FR-020) (depends on T018)

**Checkpoint**: Foundation ready — entities, contracts, migration applied, both modules
registered, and `InventoryService` fully functional. User story implementation can begin.

---

## Phase 3: User Story 1 - Aggregate pending pre-orders into a supplier order (Priority: P1) 🎯 MVP start

**Goal**: Staff pick a supplier and combine every member's still-pending, not-yet-aggregated
pre-order line for that supplier's products into one draft `SupplierOrder`, quantities
summed per product, with unorderable products skipped and reported.

**Independent Test**: With pre-orders from at least two members for the same supplier,
some sharing a product, trigger aggregation and confirm one draft supplier order is created
with one line per product, quantities correctly summed, and every contributing member
pre-order line linked to it (spec.md US1).

### E2E test for User Story 1 (write first — must fail before implementation)

- [X] T020 [US1] E2E test in `apps/web-spa-e2e/tests/admin-purchasing-aggregate.spec.ts`:
  aggregate a supplier's pending pre-orders into a draft supplier order with summed
  quantities; aggregating again with nothing new refuses with an explanation (FR-004); a
  pre-order for an archived product is skipped and reported (FR-003); a later pre-order is
  picked up only by the *next* aggregation run (FR-005)

### Implementation for User Story 1

- [X] T021 [US1] Implement `PurchasingService.aggregate(supplierId)` in
  `apps/api/src/modules/purchasing/purchasing.service.ts`: select every `OrderLine` where
  `order.orderingMode = 'pre_order'`, `order.status = 'pending'`,
  `product.supplier = supplierId`, and `supplierOrderLine IS NULL`; skip and collect lines
  whose product can no longer be ordered from its supplier (FR-003); group the rest by
  `product`, summing `quantity`; create one `SupplierOrder` (`draft`) with one
  `SupplierOrderLine` per product, and set `supplierOrderLine` on every contributing
  `OrderLine` (FR-001, FR-002); throw a `409` if nothing was eligible (FR-004)
  (research.md §2, §3)
- [X] T022 [P] [US1] Unit tests in
  `apps/api/src/modules/purchasing/tests/purchasing.service.spec.ts`: quantities summed
  per product across members, already-linked lines excluded, unorderable product skipped
  and reported with reason, `409` when nothing is pending (depends on T021)
- [X] T023 [US1] Implement `PurchasingMapper` in
  `apps/api/src/modules/purchasing/purchasing.mapper.ts`: map `SupplierOrder` →
  `supplierOrderSchema`/`supplierOrderDetailSchema` and `SupplierOrderLine` →
  `supplierOrderLineSchema`, including the read-time-computed `receivedQuantity`
  (`SUM(receptionLines.receivedQuantity)`, `0` before any reception),
  `discrepancy` (`none` before any reception), `contributingMemberCount`
  (`sourceOrderLines.length`), and `estimatedUnitCostEur` /
  `estimatedTotalEur`/`hasUnknownCostLines` via `InventoryService` (research.md §5, §8;
  depends on T011, T018)
- [X] T024 [P] [US1] Unit tests in
  `apps/api/src/modules/purchasing/tests/purchasing.mapper.spec.ts` covering the mapping
  above, including a line with no cost estimate yet (depends on T023)
- [X] T025 [US1] Implement `AdminSupplierPurchasingController` in
  `apps/api/src/modules/purchasing/purchasing.controller.ts`: `POST
  /admin/suppliers/:supplierId/purchasing/aggregate` (`404` unknown supplier, `409`
  nothing pending), following the `catalog.controller.ts` multi-class-per-file pattern
  (depends on T021, T023)
- [X] T026 [US1] Implement `AdminPurchasingController` (same file) with `GET
  /admin/purchasing/supplier-orders` (paginated, `status`/`supplierId` filters) and `GET
  /admin/purchasing/supplier-orders/:id` (depends on T023)
- [X] T027 [US1] Register `AdminSupplierPurchasingController` and
  `AdminPurchasingController` in `apps/api/src/modules/purchasing/purchasing.module.ts`
  (depends on T025, T026)
- [X] T028 [US1] Controller e2e specs in
  `apps/api/src/modules/purchasing/tests/purchasing.controller.e2e-spec.ts`: aggregate
  success with summed lines, `409` nothing-pending, skip-and-report, list/detail routes,
  `401`/`403` for anonymous/non-admin (depends on T027)
- [X] T029 [US1] Run `pnpm generate` to regenerate the typed SDK client from the new
  `purchasing` contracts and routes (depends on T011, T025, T026)
- [X] T030 [P] [US1] Implement `purchasing-queries.ts` in
  `apps/web-spa/app/features/admin-purchasing/utils/purchasing-queries.ts`: TanStack Query
  hooks for the aggregate mutation and the supplier-orders list/detail queries, using the
  generated SDK (depends on T029)
- [X] T031 [US1] Implement `supplier-orders-list-page.tsx` in
  `apps/web-spa/app/features/admin-purchasing/components/supplier-orders-list-page.tsx`:
  paginated list with supplier, status, total (depends on T030)
- [X] T032 [US1] Implement `supplier-order-detail-page.tsx` in
  `apps/web-spa/app/features/admin-purchasing/components/supplier-order-detail-page.tsx`:
  lines, quantities, total (depends on T030)
- [X] T033 [US1] Add an "Aggregate" action on the supplier detail view, linking into
  `admin-purchasing`, in `apps/web-spa/app/features/catalog/components/suppliers-tab.tsx`
  (depends on T031)
- [X] T034 [US1] Add `/admin/purchasing` and
  `/admin/purchasing/supplier-orders/:id` routes, under the existing
  `back-office-layout`, in `apps/web-spa/app/routes.ts` (depends on T031, T032)
- [X] T035 [P] [US1] Add `purchasing` i18n keys (aggregate action, list/detail labels,
  skipped-line message) to
  `apps/web-spa/app/lib/i18n/locales/en/common.locales.en.json` and
  `apps/web-spa/app/lib/i18n/locales/fr/common.locales.fr.json`

**Checkpoint**: US1 is independently functional — verify the T020 E2E spec now passes.

---

## Phase 4: User Story 2 - Send a supplier order (Priority: P1)

**Goal**: Staff review a draft supplier order and mark it sent; its lines are then fixed
against future aggregation runs.

**Independent Test**: Create a draft supplier order, review its content, mark it sent, and
confirm its status changes and its lines can no longer be altered by a new aggregation run
(spec.md US2).

### E2E test for User Story 2 (write first — must fail before implementation)

- [X] T036 [US2] E2E test (send portion) in
  `apps/web-spa-e2e/tests/admin-purchasing-reception.spec.ts`: review a draft order's
  lines/total, mark it sent, confirm re-sending is refused (FR-008), and confirm a later
  aggregation run for the same supplier leaves the sent order's lines untouched (FR-007)

### Implementation for User Story 2

- [X] T037 [US2] Implement `PurchasingService.send(id, version)` in
  `apps/api/src/modules/purchasing/purchasing.service.ts`: `draft → sent` with optimistic
  locking on `version`, `409` if not currently `draft` or `version` is stale (FR-007,
  FR-008; depends on T021)
- [X] T038 [P] [US2] Unit tests in `purchasing.service.spec.ts`: successful send, repeat-send
  refused, stale-version conflict (depends on T037)
- [X] T039 [US2] Implement `POST /admin/purchasing/supplier-orders/:id/send` and `GET
  /admin/purchasing/supplier-orders/:id/export` (plain-text/CSV summary, FR-009) in
  `purchasing.controller.ts` (depends on T037)
- [X] T040 [US2] Controller e2e specs in `purchasing.controller.e2e-spec.ts`: send success,
  repeat-send `409`, export returns a readable summary (depends on T039)
- [X] T041 [US2] Run `pnpm generate` to refresh the SDK for the send/export routes (depends
  on T039)
- [X] T042 [P] [US2] Add the send mutation and export query to `purchasing-queries.ts`
  (depends on T030, T041)
- [X] T043 [US2] Add a "Send" action and export link to `supplier-order-detail-page.tsx`
  (depends on T042)
- [X] T044 [P] [US2] Add send/export/status i18n keys to both locale files (depends on T035)

**Checkpoint**: US1 and US2 both independently functional — verify T036 passes.

---

## Phase 5: User Story 3 - Receive a delivery and watch stock and cost price update (Priority: P1)

**Goal**: Staff record what was actually received against a sent supplier order; stock and
weighted-average cost price update immediately, discrepancies are flagged without blocking,
and each affected pre-order line is marked fulfilled.

**Independent Test**: Take a sent supplier order, record a reception where one line matches
what was ordered and another is short, confirm it, and verify stock increased by exactly
the received amounts, the short line is flagged, and cost price reflects the reception
(spec.md US3).

### E2E test for User Story 3 (write first — must fail before implementation)

- [X] T045 [US3] E2E test (receive portion) in
  `apps/web-spa-e2e/tests/admin-purchasing-reception.spec.ts`: record a reception with a
  matching line, a short line, and a by-weight line within tolerance; confirm the short
  line is flagged and the by-weight line is not (research.md §5); confirm stock and cost
  price update; record a second reception on the same order and confirm both remain
  visible in history (FR-013); record a correcting third reception and confirm the earlier
  ones are unedited (FR-014)

### Implementation for User Story 3

- [X] T046 [US3] Implement `PurchasingService.recordReception(supplierOrderId, lines)` in
  `purchasing.service.ts`, wrapped in `this.em.transactional(...)` (matching the
  `orders.service.ts` `checkout` pattern): refuse (`409`) unless `status = 'sent'`
  (FR-015); `404` for an unknown line id; create one `Reception` + its `ReceptionLine`s;
  call `InventoryService.recordReceipt` once per line; for each newly-covered
  `SupplierOrderLine`'s product, set `fulfilledAt` on every linked `OrderLine` that does
  not yet have it (research.md §6, FR-024); recheck whether every line's received total is
  `>=` its ordered quantity and, if so, flip `status` to `received` (data-model.md
  "Cross-entity rules"; depends on T037, T018)
- [X] T047 [P] [US3] Unit tests in `purchasing.service.spec.ts`: unit-sold discrepancy on
  any non-zero difference, by-weight discrepancy only outside
  `product.weightTolerancePercent` (research.md §5), zero-received line flagged fully
  short, first-reception-wins fulfillment marking with no re-touch on a second reception,
  automatic `sent → received` transition, two receptions accumulating stock/cost on the
  same order (depends on T046)
- [X] T048 [US3] Implement `POST /admin/purchasing/supplier-orders/:id/receptions` in
  `purchasing.controller.ts` (`404` unknown order or line id, `409` not `sent`, `422`
  negative quantity/cost) (depends on T046)
- [X] T049 [US3] Controller e2e specs in `purchasing.controller.e2e-spec.ts`: reception
  success with discrepancy flags, refuse on `draft`/`closed`, refuse unknown line id,
  `422` on negative values (depends on T048)
- [X] T050 [US3] Run `pnpm generate` to refresh the SDK for the receptions route (depends on
  T048)
- [X] T051 [P] [US3] Add the reception mutation to `purchasing-queries.ts` (depends on T042,
  T050)
- [X] T052 [US3] Implement `reception-form.tsx` in
  `apps/web-spa/app/features/admin-purchasing/components/reception-form.tsx`:
  line-by-line received quantity and unit cost entry with discrepancy display (depends on
  T051)
- [X] T053 [US3] Wire `reception-form.tsx` and reception history into
  `supplier-order-detail-page.tsx` (depends on T052)
- [X] T054 [P] [US3] Add reception i18n keys (discrepancy labels, form fields) to both
  locale files (depends on T044)

**Checkpoint**: US1–US3 (all P1) are independently functional — the lot's core value
(pre-orders become real stock) is delivered. Verify T045 passes.

---

## Phase 6: User Story 4 - Check a product's current stock and cost price (Priority: P2)

**Goal**: Staff look up any product's current stock level and weighted average cost price
at any time, independent of just having run a reception.

**Independent Test**: After one or more receptions for a product, look it up and confirm
the displayed stock level and cost price match what the receptions produced (spec.md US4).

### E2E test for User Story 4 (write first — must fail before implementation)

- [X] T055 [US4] E2E test in `apps/web-spa-e2e/tests/admin-inventory-stock.spec.ts`: stock
  list shows a never-received product as `quantityOnHand: 0`, `costPriceEur: null`
  (FR-020); a received product's detail shows stock level, cost price, and its full
  movement history; a product received twice at different unit costs shows the
  quantity-weighted average (research.md §4)

### Implementation for User Story 4

- [X] T056 [US4] Implement `InventoryMapper` in
  `apps/api/src/modules/inventory/inventory.mapper.ts`: map product + derived
  stock/cost-price to `stockSummarySchema`/`stockDetailSchema`, movements to
  `stockMovementSchema`, newest first (depends on T013, T018)
- [X] T057 [US4] Implement `InventoryController` in
  `apps/api/src/modules/inventory/inventory.controller.ts`: `GET /admin/inventory/stock`
  (paginated, `search`/`categoryId` filters) and `GET
  /admin/inventory/products/:productId/stock` (`404` unknown product; never-received
  returns `0`/`null`/empty movements, not `404`, per FR-020) (depends on T056)
- [X] T058 [US4] Register `InventoryController` in
  `apps/api/src/modules/inventory/inventory.module.ts` (depends on T057)
- [X] T059 [US4] Controller e2e specs in
  `apps/api/src/modules/inventory/tests/inventory.controller.e2e-spec.ts`: list, detail
  including never-received product, `404` unknown product (depends on T058)
- [X] T060 [US4] Run `pnpm generate` to refresh the SDK for the inventory routes (depends
  on T057)
- [X] T061 [P] [US4] Implement `inventory-queries.ts` in
  `apps/web-spa/app/features/admin-inventory/utils/inventory-queries.ts`: TanStack Query
  hooks for the stock list/detail queries (depends on T060)
- [X] T062 [US4] Implement `stock-list-page.tsx` in
  `apps/web-spa/app/features/admin-inventory/components/stock-list-page.tsx`: paginated
  stock/cost list with search and category filter (depends on T061)
- [X] T063 [US4] Implement `stock-detail-page.tsx` in
  `apps/web-spa/app/features/admin-inventory/components/stock-detail-page.tsx`: stock
  level, cost price, movement history, each traceable to its reception (SC-003) (depends
  on T061)
- [X] T064 [US4] Add `/admin/inventory` routes under `back-office-layout` in
  `apps/web-spa/app/routes.ts` (depends on T062, T063)
- [X] T065 [P] [US4] Add `inventory` i18n keys to both locale files

**Checkpoint**: US1–US4 independently functional — verify T055 passes.

---

## Phase 7: User Story 5 - Close out a supplier order that will not be fully honored (Priority: P2)

**Goal**: Staff close a sent supplier order early when a supplier cannot deliver everything,
without disturbing stock/cost already recorded.

**Independent Test**: Take a sent supplier order with one line partially received, close it
out, and confirm its status reflects no further delivery expected while reception history
and recorded stock stay untouched (spec.md US5).

### E2E test for User Story 5 (write first — must fail before implementation)

- [X] T066 [US5] E2E test (close portion) in
  `apps/web-spa-e2e/tests/admin-purchasing-reception.spec.ts`: close a sent order with a
  line still short; confirm status shows no further delivery expected and existing
  stock/cost stay untouched (FR-021); confirm a further reception against it is refused
  (FR-022); confirm a fully-received order shows `received`, distinguishing it from
  `closed` (FR-023)

### Implementation for User Story 5

- [X] T067 [US5] Implement `PurchasingService.close(id, version)` in `purchasing.service.ts`:
  `sent → closed` with optimistic locking, `409` if not currently `sent` or `version` is
  stale (FR-021; depends on T046)
- [X] T068 [P] [US5] Unit tests in `purchasing.service.spec.ts`: successful close, refuse
  from `draft`/`received`/`closed`, refuse a reception recorded against a closed order
  (FR-022) (depends on T067)
- [X] T069 [US5] Implement `POST /admin/purchasing/supplier-orders/:id/close` in
  `purchasing.controller.ts` (depends on T067)
- [X] T070 [US5] Controller e2e specs in `purchasing.controller.e2e-spec.ts`: close success,
  refuse invalid transitions, refuse reception on a closed order (depends on T069)
- [X] T071 [US5] Run `pnpm generate` to refresh the SDK for the close route (depends on T069)
- [X] T072 [P] [US5] Add the close mutation to `purchasing-queries.ts` (depends on T051,
  T071)
- [X] T073 [US5] Add a "Close" action and a `received`/`closed` status distinction to
  `supplier-order-detail-page.tsx` (depends on T072)
- [X] T074 [P] [US5] Add close/status i18n keys to both locale files (depends on T054)

**Checkpoint**: All five user stories are independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T075 [P] Run `pnpm lint && pnpm typecheck` across `apps/api` and `apps/web-spa`, fix
  anything the new modules and feature areas introduce
- [X] T076 [P] Update any module-level documentation the README.md-cited guidelines require
  for the new `purchasing`/`inventory` modules (per CONTRIBUTING.md / project README before
  opening the PR)
- [X] T077 Walk through `specs/purchasing/quickstart.md` end to end against a fresh seed
  (`pnpm --filter=api db:fresh:seed`), confirming all five user stories behave as described
- [X] T078 Run the full E2E suite (`pnpm e2e`) and confirm every existing spec still passes
  alongside the three new ones (`admin-purchasing-aggregate`, `admin-purchasing-reception`,
  `admin-inventory-stock`); a failing test blocks the feature — a human decides whether to
  fix the test or the behavior, never edit/skip/delete an existing E2E spec to force a pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup. **Blocks every user story.**
- **User Story 1 (Phase 3)**: Depends on Foundational only.
- **User Story 2 (Phase 4)**: Depends on Foundational **and** US1 (`send` transitions the
  `SupplierOrder.status` US1's `aggregate` creates; the controller and frontend pages are
  the same files US1 built).
- **User Story 3 (Phase 5)**: Depends on Foundational **and** US2 (reception is only legal
  against a `sent` order).
- **User Story 4 (Phase 6)**: Depends on Foundational only (`InventoryService` is built in
  Phase 2) — can in principle run in parallel with US1–US3, though it is only observably
  useful once US3 has produced stock movements.
- **User Story 5 (Phase 7)**: Depends on Foundational **and** US3 (closing competes with
  reception on the same `sent → *` transition and the same controller/service files).
- **Polish (Phase 8)**: Depends on every user story that will ship.

Unlike a typical spec-kit feature, US1/US2/US3 are **not** independent of each other in
implementation, even though each has its own independent acceptance test: they are three
steps of one state machine (`draft → sent → received/closed`) built incrementally in the
same `purchasing.service.ts`/`purchasing.controller.ts` files. US4 is the one story that is
genuinely independent (a pure read module). US5 shares US3's files and its `sent`-state
precondition.

### Within Each User Story

- The story's E2E test MUST be written and fail before its implementation tasks.
- Entities/contracts (Foundational) before service logic.
- Service before mapper-dependent reads, service+mapper before controller, controller
  before its e2e spec, e2e spec passing before `pnpm generate`, generated SDK before
  frontend query hooks, hooks before pages, pages before routing, i18n keys alongside.
- A story is not complete while its E2E test fails.

### Parallel Opportunities

- Setup: T002, T003, T004 in parallel with T001.
- Foundational: T005–T010 (all entities, different files) in parallel; T011–T013 (all
  contracts) in parallel; T015 and T016 (the two module files) in parallel once their
  respective entities exist.
- Within each story: the unit-test task and the i18n task are `[P]` — different files from
  the implementation task they follow.
- US4 (Phase 6) can be staffed in parallel with US1–US3 once Phase 2 is done, since it only
  depends on the Foundational `InventoryService`.

---

## Parallel Example: Foundational Phase

```bash
# Entities — six different files, no dependencies between them:
Task: "Add supplierOrderLine/fulfilledAt to OrderLine in apps/api/src/modules/orders/entities/order-line.entity.ts"
Task: "Create SupplierOrder entity in apps/api/src/modules/purchasing/entities/supplier-order.entity.ts"
Task: "Create SupplierOrderLine entity in apps/api/src/modules/purchasing/entities/supplier-order-line.entity.ts"
Task: "Create Reception entity in apps/api/src/modules/purchasing/entities/reception.entity.ts"
Task: "Create ReceptionLine entity in apps/api/src/modules/purchasing/entities/reception-line.entity.ts"
Task: "Create StockMovement entity in apps/api/src/modules/inventory/entities/stock-movement.entity.ts"

# Contracts — three different files:
Task: "Create supplier-order.contract.ts"
Task: "Create reception.contract.ts"
Task: "Create stock.contract.ts"
```

---

## Implementation Strategy

### MVP scope: User Stories 1 + 2 + 3 together (all P1)

Because these three P1 stories form one state machine, the realistic MVP is all three, not
just US1: aggregate → send → receive is the point where the spec's core value ("pre-orders
become real stock") actually lands. Stopping after US1 alone leaves a draft order with
nowhere to go.

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (US1), verify T020 passes.
3. Complete Phase 4 (US2), verify T036 passes.
4. Complete Phase 5 (US3), verify T045 passes.
5. **STOP and VALIDATE**: walk through quickstart.md US1–US3; stock and cost price should
   update correctly with discrepancies flagged.
6. Deploy/demo if ready.

### Incremental delivery after MVP

7. Add User Story 4 (Phase 6) — a pure viewing convenience, can be pulled forward in
   parallel with steps 2–4 if staffed separately.
8. Add User Story 5 (Phase 7) — closes out orders that will not be fully honored.
9. Phase 8 (Polish): lint/typecheck, docs, quickstart re-validation, full `pnpm e2e`.

### Notes

- [P] tasks touch different files with no unfinished dependency between them.
- Commit after each task or logical group, per this repo's `git-workflow` skill.
- Never edit or delete an existing E2E spec to force it to pass — stop and ask a human.
- `pnpm generate` must be re-run (and its output committed) after any contract or route
  change, before the frontend tasks that consume the SDK.
