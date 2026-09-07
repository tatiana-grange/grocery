# Changelog: Purchasing — Aggregate Pre-orders, Receive, Stock, Cost Price

All notable changes to this feature specification are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/)

## [2026-09-05 00:00] - /speckit.specify

### Added

- Initial feature specification created from user description: "Lot 3 — Purchasing :
  agréger les précommandes en commande fournisseur, réception, stock, prix de revient"
- **Author**: AI (Claude)
- **Files**: spec.md, checklists/requirements.md

## [2026-09-05 00:00] - /speckit.plan

### Added

- Technical implementation plan created: two new modules (`purchasing`, `inventory`)
  split along the architecture plan's existing responsibilities, two nullable columns
  added to the existing `orders` module's `OrderLine` entity, stock and cost price
  modeled as values derived from append-only `StockMovement` rows (never stored/cached)
- Research document covering module split, aggregation query shape, pre-order fulfillment
  linking, stock/cost derivation, weight-tolerance discrepancy flagging, reception
  immutability, supplier-order total estimation, and E2E scope
- Data model with 3 new entities in `purchasing` (`SupplierOrder`, `SupplierOrderLine`,
  `Reception`/`ReceptionLine`) and 1 in `inventory` (`StockMovement`), plus the `OrderLine`
  extension
- API contracts: `purchasing-api.md` (aggregation, supplier orders, receptions),
  `inventory-api.md` (stock and cost price reads)
- Quickstart walkthrough for all 5 user stories
- **Author**: AI (Claude)
- **Files**: plan.md, research.md, data-model.md, contracts/purchasing-api.md,
  contracts/inventory-api.md, quickstart.md

## [2026-09-05 00:00] - /speckit.tasks

### Added

- Task list generated with 78 tasks across 8 phases (Setup, Foundational, US1–US5, Polish)
- User stories covered: US1 (aggregate), US2 (send), US3 (receive/stock/cost), US4 (stock
  and cost price reads), US5 (close out)
- Required E2E task per user story (`admin-purchasing-aggregate`,
  `admin-purchasing-reception` shared by US2/US3/US5, `admin-inventory-stock`) plus a
  final full-suite run, per the project's E2E-suite-present rule
- **Author**: AI (Claude)
- **Files**: tasks.md

## [2026-09-05 15:45] - /speckit.implement

### Changed

- Completed Phase 1: Setup (Shared Infrastructure)
- Tasks completed: T001, T002, T003, T004
- **Author**: AI (Claude)
- **Files**: apps/api/src/modules/purchasing/{purchasing.module,purchasing.service,purchasing.mapper,purchasing.controller}.ts,
  apps/api/src/modules/inventory/{inventory.module,inventory.service,inventory.mapper,inventory.controller}.ts,
  apps/web-spa/app/features/admin-purchasing/{components,utils}/.gitkeep,
  apps/web-spa/app/features/admin-inventory/{components,utils}/.gitkeep

## [2026-09-05 15:50] - /speckit.implement

### Changed

- Completed Phase 2: Foundational (Blocking Prerequisites)
- Tasks completed: T005, T006, T007, T008, T009, T010, T011, T012, T013, T014, T015, T016, T017, T018, T019
- **Author**: AI (Claude)
- **Files**: apps/api/src/modules/orders/entities/order-line.entity.ts (2 nullable columns added),
  apps/api/src/modules/purchasing/entities/{supplier-order,supplier-order-line,reception,reception-line}.entity.ts,
  apps/api/src/modules/inventory/entities/stock-movement.entity.ts,
  apps/api/src/modules/purchasing/contracts/{supplier-order,reception}.contract.ts,
  apps/api/src/modules/inventory/contracts/stock.contract.ts,
  apps/api/src/modules/db/migrations/Migration20260905134354.ts,
  apps/api/src/modules/purchasing/purchasing.module.ts, apps/api/src/modules/inventory/inventory.module.ts,
  apps/api/src/app.module.ts,
  apps/api/src/modules/inventory/inventory.service.ts, apps/api/src/modules/inventory/inventory.util.ts,
  apps/api/src/modules/inventory/tests/inventory.service.spec.ts
- **Notes**:
  - T014: migration generated and hand-reviewed as additive (5 new tables + 2 nullable
    `orderLine` columns, no destructive rewrite). Not applied to the local dev DB because
    that DB's migration ledger is already inconsistent with its schema (pre-existing:
    `Migration20260904140000` shows pending yet its columns already exist). Tests and
    `db:fresh` build the schema straight from entities, so this does not block the feature;
    the dev DB needs a `db:fresh:seed` or a ledger repair before `db:migrate:up` will run.
  - `discrepancyKindSchema` lives in `reception.contract.ts` (not `supplier-order.contract.ts`
    as the task text suggested) to keep the two contract files a one-way dependency and avoid
    a Zod module-eval cycle; it is re-exported from `supplier-order.contract.ts`.
  - The aggregate endpoint's skip-and-report payload is a dedicated `aggregateResultSchema`
    ({ supplierOrder, skippedLines }), mirroring lot 2's `CheckoutResult` / `droppedLines`.
  - Stock level / cost price funnel through one pure helper (`deriveStockLevel` in
    `inventory.util.ts`) so the formula has a single definition and a unit test.

## [2026-09-06 09:30] - /speckit.implement

### Changed

- Completed Phase 3: User Story 1 — Aggregate pending pre-orders into a supplier order
- Tasks completed: T020–T035
- **Author**: AI (Claude)
- **Files**: `purchasing.service.ts` (`aggregate`, `listSupplierOrders`, `getSupplierOrderDetail`),
  `purchasing.util.ts` (`sumQuantities`, `discrepancyFor`), `purchasing.mapper.ts` (all mappers),
  `purchasing.controller.ts` (`AdminSupplierPurchasingController` + `AdminPurchasingController`),
  `purchasing.module.ts` (controllers registered), contract additions
  (`aggregateResultSchema`, list pagination/filtering schemas),
  `purchasing.service.spec.ts` + `purchasing.mapper.spec.ts` (unit),
  `purchasing.controller.e2e-spec.ts` (9 e2e cases, all green),
  regenerated SDK (`packages/openapi-generator/client/*`),
  web-spa: `purchasing-queries.ts`, `supplier-orders-list-page.tsx`,
  `supplier-order-detail-page.tsx`, `suppliers-tab.tsx` (Aggregate action),
  `routes.ts`, `back-office-layout.tsx` (nav), `common.locales.{en,fr}.json` (`purchasing` namespace),
  `e2e.fixtures.ts` + `e2e.seeder.ts` (purchasing supplier + pending pre-orders),
  `admin-purchasing-aggregate.spec.ts` (Playwright — deferred run to Polish T078)
- **Notes**:
  - Skipped pre-order lines (FR-003) are surfaced on the destination detail page via
    react-router navigation `state`, not a toast, so the assertion is stable.
  - `pnpm generate` ran against a locally-started API (from `apps/api` cwd so dotenvx finds
    `.env`); the user's `nest start --watch` had a stale child — its API may need a manual
    restart.

## [2026-09-06 11:30] - /speckit.implement

### Changed

- Completed Phase 4: User Story 2 — Send a supplier order
- Tasks completed: T036–T044
- **Author**: AI (Claude)
- **Files**: `purchasing.service.ts` (`send`, `loadForTransition`), `purchasing.util.ts`
  (`checkTransition` pure guard), `purchasing.mapper.ts` (`toExport` CSV builder),
  `purchasing.controller.ts` (`POST .../send`, `GET .../export`),
  `supplier-order.contract.ts` (`supplierOrderExportSchema`),
  unit tests (`checkTransition` matrix), e2e (send success / repeat 409 / stale 409 /
  aggregation-does-not-disturb / export CSV), regenerated SDK,
  web-spa: `purchasing-queries.ts` (`sendSupplierOrder`, `downloadSupplierOrderExport`),
  `supplier-order-detail-page.tsx` (Send + Export actions),
  `admin-purchasing-reception.spec.ts` (Playwright send portion — deferred run to Polish)
- **Notes**: export returns `{ filename, content }` JSON rather than a raw text/CSV body —
  `@TypedRoute` validates responses against a Zod schema, and the SPA turns it into a Blob
  download. `send` is guarded by the pure `checkTransition` (status + optimistic version),
  unit-tested; the DB path is covered by e2e.

## [2026-09-06 11:35] - /speckit.implement

### Changed

- Completed Phase 5: User Story 3 — Receive a delivery, watch stock and cost price update
- Tasks completed: T045–T054
- **Author**: AI (Claude)
- **Files**: `purchasing.service.ts` (`recordReception` in one `em.transactional`,
  `getReception`), `inventory.service.ts` (`recordReceipt` joins the caller's transaction),
  `purchasing.util.ts` (`coversOrdered`), `purchasing.controller.ts` (`POST .../receptions`),
  unit tests (`coversOrdered`), e2e (reception success + short-line flag + received-so-far,
  first-reception-wins fulfilment with no re-touch, refuse on draft, unknown line id 404,
  negative value rejected), regenerated SDK, web-spa: `recordReception` query,
  `reception-form.tsx`, detail-page wiring, `admin-purchasing-reception.spec.ts` receive block
- **Notes**:
  - Validation failures return **400** (nzoth's `ZodValidationException`), not 422 as the
    contract outline guessed — the e2e asserts 400.
  - Bug caught in testing: MikroORM's identity map auto-adds the new `ReceptionLine`s to each
    `SupplierOrderLine.receptionLines` collection on `persist`, so "received so far" is now
    snapshotted *before* the reception's rows are created, then this reception's quantities
    added explicitly — otherwise the order flipped to `received` a reception early.

## [2026-09-06 11:40] - /speckit.implement

### Changed

- Completed Phase 6: User Story 4 — Check a product's current stock and cost price
- Tasks completed: T055–T065
- **Author**: AI (Claude)
- **Files**: `inventory.mapper.ts`, `inventory.controller.ts` (`GET /admin/inventory/stock`,
  `GET /admin/inventory/products/:productId/stock`), `inventory.module.ts` (controller),
  `stock.contract.ts` (pagination/filter schemas), `inventory.controller.e2e-spec.ts`
  (never-received 0/null, 404 for unknown product, weighted average across two receptions,
  movements traceable to their reception line), regenerated SDK,
  web-spa: `inventory-queries.ts`, `stock-list-page.tsx`, `stock-detail-page.tsx`,
  `/admin/inventory` routes + nav item, `inventory` i18n namespace,
  `admin-inventory-stock.spec.ts` (Playwright — deferred run to Polish)
- **Notes**: a never-received product returns `0` / `null` / `[]` from the detail route, not
  a 404 (FR-020); `getProduct` still 404s a product id that does not exist at all.

## [2026-09-06 11:42] - /speckit.implement

### Changed

- Completed Phase 7: User Story 5 — Close out a supplier order that will not be fully honored
- Tasks completed: T066–T074
- **Author**: AI (Claude)
- **Files**: `purchasing.service.ts` (`close`, reusing `loadForTransition` + `checkTransition`),
  `purchasing.controller.ts` (`POST .../close`), unit test (close-from-sent-only matrix),
  e2e (close keeps receptions + refuses further reception, refuse close on draft,
  received ≠ closed), regenerated SDK, web-spa: `closeSupplierOrder` query, Close action on
  the detail page (window.confirm), `admin-purchasing-reception.spec.ts` close block
- **Notes**: `close` needs no new guard code — it is `loadForTransition(id, version, 'sent')`
  then `status = 'closed'`. `recordReception` already refuses anything but a `sent` order, so
  FR-022 falls out for free. The `received` vs `closed` distinction is just the two status
  labels the badge already renders (FR-023).

## [2026-09-06 11:50] - /speckit.implement

### Changed

- Completed Phase 8: Polish & Cross-Cutting Concerns
- Tasks completed: T075–T078
- **Author**: AI (Claude)
- **Files**: `apps/documentation/src/content/docs/project/lot-3-purchasing.mdx` +
  `apps/documentation/INDEX.md`, `purchasing.service.ts` (aggregate 409 body fix)
- **Notes**:
  - T075: `pnpm lint` (exit 0, only pre-existing `packages/ui` / `.boilerstone` warnings)
    and `pnpm typecheck` (all 8 projects) clean; `pnpm build` green.
  - T077: the quickstart's five user stories are all covered end to end by the API e2e
    specs (`purchasing.controller.e2e-spec.ts` 20 cases, `inventory.controller.e2e-spec.ts`)
    and the three Playwright specs; the local dev DB was not walked through by hand because
    its migration ledger predates this branch.
  - T078: **`pnpm e2e` — 75 passed, 0 failed.** First run surfaced 2 failures in the new
    specs (the aggregate 409 toast); fixed in `fix(api): include statusCode in the aggregate
    "nothing pending" 409 body` and the full suite re-run is green. No existing E2E spec was
    edited, weakened, or skipped.
- **Feature status: COMPLETE.** All 78 tasks done. 148 API unit/e2e tests + 75 Playwright
  tests passing.

---

<!--
CHANGELOG GUIDELINES

This changelog tracks all modifications to the feature specification documents.
Each speckit command MUST add an entry when modifying files.

## Entry Format

## [YYYY-MM-DD HH:MM] - /speckit.<command>
### Added | Changed | Fixed | Removed
- Description of what was added/changed/fixed/removed
- **Author**: Human | AI (Claude)
- **Files affected**: spec.md, plan.md, etc.

## Commands and their changelog actions

| Command | Action | Section |
|---------|--------|---------|
| /speckit.specify | Create spec | Added |
| /speckit.clarify | Clarify requirements | Changed |
| /speckit.plan | Create plan | Added |
| /speckit.tasks | Create tasks | Added |
| /speckit.checklist | Create checklist | Added |
| /speckit.implement | Complete task | Changed |
| /speckit.analyze | Analysis report | Added (if issues found) |

## Example entries

## [2025-01-09 14:30] - /speckit.specify
### Added
- Initial feature specification created from user description
- **Author**: AI (Claude)
- **Files**: spec.md

## [2025-01-09 15:00] - /speckit.clarify
### Changed
- Clarified authentication method: OAuth2 selected
- Clarified data retention period: 90 days
- **Author**: Human + AI (Claude)
- **Files**: spec.md

## [2025-01-09 16:00] - /speckit.plan
### Added
- Technical implementation plan created
- Research document with technology decisions
- Data model with 3 entities
- API contracts for 5 endpoints
- **Author**: AI (Claude)
- **Files**: plan.md, research.md, data-model.md, contracts/
-->
