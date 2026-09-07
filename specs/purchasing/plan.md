# Implementation Plan: Purchasing — Aggregate Pre-orders, Receive, Stock, Cost Price

**Branch**: `feat/purchasing` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/purchasing/spec.md`

## Summary

Lot 3 turns lot 2's pending pre-orders into stock the cooperative can distribute. Two new
modules, both already on the constitution's pre-approved list and split the way the
architecture plan already describes: **purchasing** (`SupplierOrder`/`SupplierOrderLine`
aggregated from pre-orders, `Reception`/`ReceptionLine` recording what actually arrived)
and **inventory** (`StockMovement`, the append-only source of a product's stock level and
weighted average cost price). The existing `orders` module gains two nullable columns on
`OrderLine` (`supplierOrderLine`, `fulfilledAt`) so a member's pre-order can be traced
through aggregation and marked fulfilled once received. The frontend adds two new admin
areas to `apps/web-spa` (`admin-purchasing`, `admin-inventory`), built from existing
`@grocery/ui` shadcn primitives, alongside the `admin-members`/`catalog` precedent.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 24.13.0, pnpm 10.28.2 workspace.
**Primary Dependencies**: NestJS, MikroORM (PostgreSQL), Zod, `@lonestone/nzoth/server`,
Better Auth `admin` plugin (backend, all existing); React, react-router, TanStack Query,
react-hook-form + Zod, Tailwind CSS + shadcn/ui via `@grocery/ui`, `@grocery/i18n`, Lucide
icons (frontend, all existing).
**Storage**: PostgreSQL via MikroORM. New tables: `supplierOrder`, `supplierOrderLine`,
`reception`, `receptionLine`, `stockMovement`. Two new nullable columns on the existing
`orderLine` table (`supplierOrderLine`, `fulfilledAt`).
**Testing**: vitest for API unit and controller e2e specs; Playwright for the web-spa e2e
suite (`apps/web-spa-e2e`).
**E2E suite present?**: **Yes** — `apps/web-spa-e2e` (Playwright, `pnpm e2e`). This
feature MUST ship its own Playwright specs (aggregation, sending, reception, stock/cost
reads, closing an order) and is only considered done when the full `pnpm e2e` suite passes.
A failing E2E test blocks the feature; a human decides whether to fix the test or the
behaviour, per the project's E2E guide.
**Target Platform**: Web — NestJS API (Linux server) + React SPA (browser), same as lots 1
and 2.
**Project Type**: Web application (existing `apps/api` + `apps/web-spa` monorepo split).
**Performance Goals**: No new performance target beyond the existing admin-screen "feels
instant" bar, for a single cooperative's pre-order and delivery volume (low hundreds of
pre-order lines per aggregation run).
**Constraints**: Money stored as integer cents (`amountCents`, `currency: 'EUR'`), same as
`ProductPrice`/`OrderLine`. Weight quantities carry 3-decimal precision (grams), same as
`CartLine`/`OrderLine`. Confirming a reception (create `Reception` + `ReceptionLine`s +
`StockMovement`s + fulfillment marking + status recheck) runs inside one DB transaction
(MikroORM's default per-request transaction), per Principle II. Stock level and weighted
average cost price are always computed from `StockMovement` rows at read time, never cached
on `Product` (research.md §4).
**Scale/Scope**: Single cooperative, single location — same as the rest of the app.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
| --- | --- | --- |
| I. Full-Stack Type Safety | New entities → Zod contracts with `.meta()` → typed routes → `pnpm generate` → SDK. `supplierOrderStatus`, `discrepancyKind`, and `stockMovementReason` are contract-level enums, not entity-level. | ✅ Pass |
| II. Immutable Money and Stock Ledgers | `StockMovement` is the append-only ledger this lot introduces — never edited; stock level and weighted average cost price are always derived by summing its rows, never a stored field that gets overwritten (research.md §4). `Reception`/`ReceptionLine` are likewise write-once (research.md §7): a mistake is corrected with a new reception, never an edit. Confirming a reception (the only multi-row write besides aggregation) runs inside one DB transaction. | ✅ Pass |
| III. Module Boundaries and the Reference Pattern | `purchasing` and `inventory` are both on the constitution's pre-approved module list, split along the exact responsibilities the architecture plan already assigns them (research.md §1). Fixed module file shape followed; `purchasing.controller.ts` holds more than one controller class in one file, per the existing `catalog.controller.ts` precedent. The existing `orders` module's `OrderLine` entity gains two nullable, cross-module bookkeeping columns — a deviation recorded in Complexity Tracking. | ✅ Pass (with recorded deviation) |
| IV. Independently Testable Increments | 5 prioritised user stories (P1 ×3, P2 ×2), each independently testable per the spec; each gets its own e2e coverage (API + Playwright). Cost price and discrepancy logic — both money/stock-adjacent — get dedicated unit tests, per Principle IV's explicit rule for money/stock/sale-by-weight logic. | ✅ Pass |
| V. Single-Cooperative Scope Discipline | No multi-site, directory, or group-order concept introduced. The `grocer` role is deliberately not introduced here (spec Assumptions) — it stays lot 4's job, consistent with the lot 1 note that `grocer` arrives in lot 4. | ✅ Pass |

One recorded deviation (see Complexity Tracking), from guidance that is not
NON-NEGOTIABLE: the "audit fields on every entity" data rule (extending the exact
precedent lot 2 already set for `OrderLine`), plus the cross-module column addition.
Principles I, II, IV, and V are clean.

## Project Structure

### Documentation (this feature)

```text
specs/purchasing/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── purchasing-api.md   # Aggregation, supplier orders, receptions
│   └── inventory-api.md    # Stock and cost price reads
└── tasks.md              # Phase 2 output (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
apps/api/src/modules/
├── orders/                              # existing module, extended
│   ├── entities/order-line.entity.ts    # + supplierOrderLine (nullable FK), fulfilledAt (nullable)
│   └── tests/orders.controller.e2e-spec.ts  # unaffected routes; new fields covered by purchasing's own specs
│
├── purchasing/                          # NEW module
│   ├── purchasing.module.ts
│   ├── purchasing.controller.ts         # @AdminOnly() — AdminSupplierPurchasingController (aggregate,
│   │                                     #   nested under /admin/suppliers/:supplierId/purchasing/aggregate)
│   │                                     #   + AdminPurchasingController (supplier-orders*, receptions),
│   │                                     #   two classes in one file, per the catalog.controller.ts precedent
│   ├── purchasing.service.ts            # aggregate, send, recordReception, close
│   ├── purchasing.mapper.ts
│   ├── entities/
│   │   ├── supplier-order.entity.ts
│   │   ├── supplier-order-line.entity.ts
│   │   ├── reception.entity.ts
│   │   └── reception-line.entity.ts
│   ├── contracts/
│   │   ├── supplier-order.contract.ts
│   │   └── reception.contract.ts
│   └── tests/
│       ├── purchasing.controller.e2e-spec.ts
│       ├── purchasing.service.spec.ts   # unit: aggregation grouping/sum, discrepancy tolerance,
│       │                                 # fulfillment marking, status transitions
│       └── purchasing.mapper.spec.ts
│
├── inventory/                            # NEW module
│   ├── inventory.module.ts
│   ├── inventory.controller.ts           # @AdminOnly() GET /admin/inventory/stock*
│   ├── inventory.service.ts              # recordReceipt (called by purchasing.service.ts within its
│   │                                      #   reception transaction), stock-level / cost-price aggregate reads
│   ├── inventory.mapper.ts
│   ├── entities/stock-movement.entity.ts
│   ├── contracts/stock.contract.ts
│   └── tests/
│       ├── inventory.controller.e2e-spec.ts
│       └── inventory.service.spec.ts     # unit: stock-level sum, weighted-average-cost aggregate
│
└── db/migrations/
    └── Migration<timestamp>_purchasing.ts   # orderLine.supplierOrderLine/fulfilledAt +
                                              # supplierOrder/supplierOrderLine/reception/receptionLine/
                                              # stockMovement tables

apps/web-spa/app/
├── features/
│   ├── admin-purchasing/                 # NEW
│   │   ├── components/
│   │   │   ├── supplier-orders-list-page.tsx
│   │   │   ├── supplier-order-detail-page.tsx   # lines, total, send/close actions, reception history
│   │   │   └── reception-form.tsx
│   │   └── utils/purchasing-queries.ts
│   ├── admin-inventory/                  # NEW
│   │   ├── components/
│   │   │   ├── stock-list-page.tsx
│   │   │   └── stock-detail-page.tsx     # movement history
│   │   └── utils/inventory-queries.ts
│   └── catalog/                          # existing — supplier detail page gets an "Aggregate" action
│       └── components/suppliers-tab.tsx  # (or supplier-detail, if one exists) linking into admin-purchasing
├── routes.ts                             # + /admin/purchasing, /admin/purchasing/supplier-orders/:id,
│                                          #   /admin/inventory under the existing admin-area layout
└── lib/i18n/locales/{en,fr}/             # + purchasing / inventory namespaces

apps/web-spa-e2e/tests/
├── admin-purchasing-aggregate.spec.ts    # NEW — aggregate, nothing-pending block, skip-and-report
├── admin-purchasing-reception.spec.ts    # NEW — send, receive (full/short/over), correction, close
└── admin-inventory-stock.spec.ts         # NEW — stock/cost list and detail, never-received product
```

**Structure Decision**: Web application, existing monorepo split (`apps/api` +
`apps/web-spa`). No new app or package. Two new backend modules (`purchasing`,
`inventory`) and two new admin-only frontend feature areas, alongside the existing
`admin-members`/`catalog` admin surface.

## Complexity Tracking

| Deviation | Why it is needed | Simpler alternative rejected |
| --- | --- | --- |
| `Reception` and `ReceptionLine` carry `createdAt` but no `updatedAt`, against the Technology Constraints data rule "`createdAt` and `updatedAt` audit fields on every entity". | Both are written once at reception time and never edited afterward (FR-014) — an `updatedAt` would always equal `createdAt`, and if it ever moved it would signal a bug rather than record useful history. Extends the exact precedent lot 2 already recorded for `OrderLine`. | Add an `updatedAt` that never changes — rejected as misleading noise on rows the code must never touch after creation. |
| The existing `orders` module's `OrderLine` entity (lot 2) gains two nullable columns — `supplierOrderLine` and `fulfilledAt` — written by the new `purchasing` module after the row's creation, with no corresponding `updatedAt` bump. | `OrderLine`'s checkout data (product, quantity, price) must stay exactly as lot 2 left it; these two columns record a one-time-each fact about what happened to the line *afterward* (research.md §3), not an edit to that checkout data. Keeping them on `OrderLine` — rather than a new join table — matches the always-1:1-once-set relationship exactly and lets aggregation's "not yet linked" query stay a plain `WHERE supplierOrderLine IS NULL`. | A separate `SupplierOrderLineSource` join entity — rejected as over-normalized for a relationship with no real multiplicity to model (research.md §3), adding a table and a migration for information two nullable columns already capture. |
