# Implementation Plan: Shop and Orders — Public Catalogue, Cart, Pre-order vs In-store Order

**Branch**: `feat/shop-orders` | **Date**: 2026-09-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/shop-orders/spec.md`

## Summary

Lot 2 turns the lot 1 catalogue into a shop. Two changes to the existing **catalog**
module (a `orderingMode` field on `Product`, and a public `@Public()` read surface under
`/shop/*`) plus one new **orders** module (`Cart`/`CartLine` for in-progress selection,
`Order`/`OrderLine` created at checkout, split by ordering type). The frontend adds a
public shop area, a cart, and an order-history area to `apps/web-spa`, built as far as
possible from existing `@grocery/ui` shadcn primitives (no new primitives expected).

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 24.13.0, pnpm 10.28.2 workspace.
**Primary Dependencies**: NestJS, MikroORM (PostgreSQL), Zod, `@lonestone/nzoth/server`,
Better Auth (backend, all existing); React, react-router, TanStack Query,
react-hook-form + Zod, Tailwind CSS + shadcn/ui via `@grocery/ui`, `@grocery/i18n`, Lucide
icons (frontend, all existing).
**Storage**: PostgreSQL via MikroORM. New tables: `cart`, `cartLine`, `order`,
`orderLine`. One new column on the existing `product` table (`orderingMode`).
**Testing**: vitest for API unit and controller e2e specs; Playwright for the web-spa e2e
suite (`apps/web-spa-e2e`).
**E2E suite present?**: **Yes** — `apps/web-spa-e2e` (Playwright, `pnpm e2e`). This
feature MUST ship its own Playwright specs (shop browsing, cart, checkout, order history)
and is only considered done when the full `pnpm e2e` suite passes. A failing E2E test
blocks the feature; a human decides whether to fix the test or the behaviour, per the
project's E2E guide.
**Target Platform**: Web — NestJS API (Linux server) + React SPA (browser), same as lot 1.
**Project Type**: Web application (existing `apps/api` + `apps/web-spa` monorepo split).
**Performance Goals**: No new performance target beyond lot 1's implicit "feels instant"
bar for a catalogue in the low hundreds of products and a cooperative of ~100–300 members.
**Constraints**: Money stored as integer cents (`amountCents`, `currency: 'EUR'`), same as
`ProductPrice`. Checkout runs inside one DB transaction (MikroORM's default
per-request transaction). Weight quantities carry 3-decimal precision (grams).
**Scale/Scope**: Single cooperative, single location — same as the rest of the app.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
| --- | --- | --- |
| I. Full-Stack Type Safety | New entities → Zod contracts with `.meta()` → typed routes → `pnpm generate` → SDK. `productOrderingMode`, `orderingModeChoice`, order `status` are contract-level enums, not entity-level. | ✅ Pass |
| II. Immutable Money and Stock Ledgers | Lot 2 writes no `WalletEntry` or `StockMovement` row — no money moves and no stock is decremented (explicitly out of scope; see spec Assumptions). `OrderLine` snapshots the price charged and is never edited after checkout, in the same spirit, but it is not the wallet/stock ledger itself. (`OrderLine` also omits `updatedAt` — recorded in Complexity Tracking.) | ✅ Pass (not applicable) |
| III. Module Boundaries and the Reference Pattern | New `orders` module is on the constitution's pre-approved module list. The `orderingMode` field and the public `/shop/*` controllers extend `catalog`, which already owns "products ... units" — no new module needed, no boundary violation. The `orders` module and the `catalog` shop surface split their controller/service files by guard regime — a file-layout deviation recorded in Complexity Tracking. | ✅ Pass (with recorded deviation) |
| IV. Independently Testable Increments | 5 prioritised user stories (P1 ×3, P2 ×2), each independently testable per the spec; each gets its own e2e coverage (API + Playwright). | ✅ Pass |
| V. Single-Cooperative Scope Discipline | No multi-site, directory, or group-order concept introduced. | ✅ Pass |

Two recorded deviations (see Complexity Tracking), both from guidance that is not
NON-NEGOTIABLE: the "audit fields on every entity" data rule, and Principle III's one-file
module shape. Principles I, II, IV, and V are clean.

## Project Structure

### Documentation (this feature)

```text
specs/shop-orders/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   ├── shop-catalog-api.md   # Public /shop/* additions to the catalog module
│   └── orders-api.md         # New /cart/* and /orders/* endpoints
└── tasks.md              # Phase 2 output (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
apps/api/src/modules/
├── catalog/                          # existing module, extended
│   ├── entities/product.entity.ts    # + orderingMode field
│   ├── contracts/product.contract.ts # + productOrderingModeSchema, + orderingMode on
│   │                                  #   productSchema / createProductSchema / updateProductSchema
│   ├── catalog.service.ts            # + shop-facing read methods (orderable-only, category-with-stock filter)
│   ├── catalog.mapper.ts             # + shop product/category mappers
│   ├── shop-catalog.controller.ts    # NEW — @Public() GET /shop/categories, /shop/products, /shop/products/:id
│   └── tests/shop-catalog.controller.e2e-spec.ts   # NEW
│
├── orders/                           # NEW module
│   ├── orders.module.ts
│   ├── cart.controller.ts            # @MemberScoped() GET/POST/PUT/DELETE /cart, /cart/lines*
│   ├── orders.controller.ts          # @MemberScoped() GET/POST /orders*
│   ├── cart.service.ts
│   ├── orders.service.ts             # checkout, cancel, repeat
│   ├── orders.mapper.ts
│   ├── entities/
│   │   ├── cart.entity.ts
│   │   ├── cart-line.entity.ts
│   │   ├── order.entity.ts
│   │   └── order-line.entity.ts
│   ├── contracts/
│   │   ├── cart.contract.ts
│   │   └── order.contract.ts
│   └── tests/
│       ├── orders.controller.e2e-spec.ts   # covers both cart.controller.ts and orders.controller.ts routes,
│       │                                    # one file per the module's fixed test-file shape (see catalog precedent)
│       ├── orders.mapper.spec.ts
│       └── orders.service.spec.ts    # unit: checkout split, price snapshot, weight validation
│
└── db/migrations/
    └── Migration<timestamp>_shop_orders.ts   # product.orderingMode + cart/cartLine/order/orderLine tables

apps/web-spa/app/
├── features/
│   ├── shop/                         # NEW — public catalogue
│   │   ├── components/shop-page.tsx
│   │   ├── components/shop-product-detail-page.tsx
│   │   ├── components/product-card.tsx
│   │   ├── components/category-filter.tsx
│   │   └── utils/shop-queries.ts
│   ├── cart/                         # NEW
│   │   ├── components/cart-page.tsx
│   │   ├── components/cart-line-row.tsx
│   │   ├── components/add-to-cart-form.tsx
│   │   ├── hooks/use-cart-count.ts
│   │   └── utils/cart-queries.ts
│   ├── orders/                       # NEW — member order history
│   │   ├── components/orders-list-page.tsx
│   │   ├── components/order-detail-page.tsx
│   │   └── utils/orders-queries.ts
│   └── common/components/
│       └── shop-layout.tsx           # NEW — public shell (not session-gated), cart badge + sign-in link
├── routes.ts                         # + /shop, /shop/products/:productId under shop-layout
│                                      # + /cart, /orders, /orders/:orderId under the existing member-area-layout
└── lib/i18n/locales/{en,fr}/         # + shop / cart / orders namespaces

apps/web-spa-e2e/tests/
├── shop-catalog.spec.ts              # NEW — browse, search, sort, hidden empty category
├── cart.spec.ts                      # NEW — add/update/remove, mixed ordering types, sign-in prompt
├── checkout.spec.ts                  # NEW — split by type, empty-cart block, price-change / archived edge cases
└── orders-history.spec.ts            # NEW — list, detail, repeat, cancel
```

**Structure Decision**: Web application, existing monorepo split (`apps/api` +
`apps/web-spa`). No new app or package. The public shop and the cart/orders area both
live in `apps/web-spa`, per the architecture plan's "web-spa serves both the public shop
and the back office."

## Complexity Tracking

| Deviation | Why it is needed | Simpler alternative rejected |
| --- | --- | --- |
| `OrderLine` carries `createdAt` but no `updatedAt`, against the Technology Constraints data rule "`createdAt` and `updatedAt` audit fields on every entity". | `OrderLine` is an immutable checkout snapshot — written once, never updated. An `updatedAt` would always equal `createdAt`, and if it ever moved it would signal a bug rather than record useful history. Same spirit as Principle II's append-only ledger rows. | Add an `updatedAt` that never changes — rejected as misleading noise on a row the code must never touch after checkout. |
| The `orders` module splits its controller and service by concern (`cart.controller.ts` + `orders.controller.ts`, `cart.service.ts` + `orders.service.ts`), and `catalog` gains a second controller file `shop-catalog.controller.ts` with its own `tests/shop-catalog.controller.e2e-spec.ts`, rather than the single `*.controller.ts` / `*.service.ts` / one-e2e-file shape in Principle III. | Cart routes are member-scoped mutable scratch space; order routes are member-scoped immutable history; shop routes are `@Public()` read-only. Each set has a different guard and contract surface, and the public shop must stay auditable for field leaks in isolation from the admin catalogue. `orders.mapper.ts` stays a single file; `entities/` and `contracts/` use the subfolder form the constitution already allows for >1. | One `orders.controller.ts` with three classes and one combined catalog controller/e2e file — rejected: it mixes `@Public()` and `@MemberScoped()` routes in one file and makes the public surface harder to review. |
