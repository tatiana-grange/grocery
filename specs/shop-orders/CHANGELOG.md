# Changelog: Shop and Orders — Public Catalogue, Cart, Pre-order vs In-store Order

All notable changes to this feature specification are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/)

## [2026-09-04 00:00] - /speckit.specify

### Added

- Initial feature specification created from user description: "Réalise le LOT 2 : Boutique
  & commandes — boutique publique, panier, précommande producteur vs commande sur stock."
- **Author**: AI (Claude)
- **Files**: spec.md, checklists/requirements.md

## [2026-09-04 00:00] - /speckit.plan

### Added

- Technical implementation plan created: extends the `catalog` module with a
  `orderingMode` product field and a public `/shop/*` read surface, and adds a new
  `orders` module (`Cart`/`CartLine`, `Order`/`OrderLine`) for cart, checkout, order
  history, repeat, and cancel.
- Phase 0 research resolving 8 design decisions (ordering-mode ownership, cart-vs-draft-
  order modelling, weight quantity representation, checkout split, repeat-merge
  behaviour, order status enum, public-controller strategy, E2E strategy).
- Phase 1 data model (`Product` extension, `Cart`, `CartLine`, `Order`, `OrderLine`),
  API contracts (`shop-catalog-api.md`, `orders-api.md`), and a quickstart walkthrough.
- Constitution check passed with no violations; Complexity Tracking table is empty.
- **Author**: AI (Claude)
- **Files**: plan.md, research.md, data-model.md, contracts/shop-catalog-api.md,
  contracts/orders-api.md, quickstart.md

## [2026-09-04 00:00] - /speckit.tasks

### Added

- Task list generated with 72 tasks across 8 phases (Setup, Foundational, 5 user-story
  phases, Polish).
- User stories covered: US1 (browse the public shop, 12 tasks), US2 (build a cart, 12
  tasks), US3 (check out, 9 tasks), US4 (order history and repeat, 10 tasks), US5 (cancel
  a pending order, 6 tasks).
- Every user-story phase includes its own Playwright E2E task and backend controller e2e
  coverage, plus a Polish-phase task running the full `pnpm e2e` suite.
- **Author**: AI (Claude)
- **Files**: tasks.md

## [2026-09-04 00:00] - /speckit.implement

### Changed

- Completed Phase 1: Setup. Added `orderingMode` (`pre_order` / `in_store` / `both`) to the
  `catalog` module's `Product` entity and contract; extended the demo seeder with one
  product per ordering mode plus a category whose only product is archived; added an
  ordering-mode picker to the admin product form (defaults to `in_store` so the existing
  Playwright catalog spec keeps passing unmodified); added empty `shop` / `cart` / `orders`
  top-level keys to the existing `common` i18n namespace (this project keeps one `common`
  locale file rather than one file per namespace, so this is where the per-story keys will
  land in later phases); created the `orders` module's `entities/`, `contracts/`, `tests/`
  directories; reseeded the database and regenerated the OpenAPI client.
- Tasks completed: T001, T002, T003, T004, T005
- **Author**: AI (Claude)
- **Files**: apps/api/src/modules/catalog/contracts/product.contract.ts,
  apps/api/src/modules/catalog/entities/product.entity.ts,
  apps/api/src/modules/catalog/catalog.service.ts, apps/api/src/modules/catalog/catalog.mapper.ts,
  apps/api/src/modules/catalog/catalog.factory.ts, apps/api/src/modules/catalog/catalog.seeder.ts,
  apps/api/src/modules/catalog/tests/catalog.controller.e2e-spec.ts,
  apps/api/src/modules/catalog/tests/catalog.mapper.spec.ts,
  apps/web-spa/app/features/catalog/components/product-form-page.tsx,
  apps/web-spa/app/lib/i18n/locales/{en,fr}/common.locales.*.json,
  packages/openapi-generator/client/*, specs/shop-orders/tasks.md

## [2026-09-04 00:00] - /speckit.implement

### Changed

- Completed Phase 2: Foundational. Added the `orders` module's `Cart`/`CartLine`/
  `Order`/`OrderLine` entities, the shared `orderingModeChoiceSchema` /
  `orderStatusSchema` contract enums, `orders.module.ts` (registered on `AppModule`,
  no controllers yet), `cart.service.ts` / `orders.service.ts` / `orders.mapper.ts`
  skeletons, and the public `shop-layout.tsx` shell (cart badge wired later in Phase
  4/T037, once the cart exists). Reseeded the database to create the four new tables.
- Tasks completed: T006, T007, T008, T009, T010, T011, T012, T013, T014
- **Author**: AI (Claude)
- **Files**: apps/api/src/modules/orders/entities/{cart,cart-line,order,order-line}.entity.ts,
  apps/api/src/modules/orders/contracts/order.contract.ts,
  apps/api/src/modules/orders/{orders.module,cart.service,orders.service,orders.mapper}.ts,
  apps/api/src/app.module.ts, apps/web-spa/app/features/common/components/shop-layout.tsx,
  apps/web-spa/app/lib/i18n/locales/{en,fr}/common.locales.*.json

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
