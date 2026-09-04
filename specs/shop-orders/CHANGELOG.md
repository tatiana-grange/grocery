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

## [2026-09-04 00:00] - /speckit.implement

### Changed

- Completed Phase 3: User Story 1 (browse the public shop). Added the `/shop/*` public
  read surface (`ShopCatalogController`, narrower `shop-catalog.contract.ts`, and
  `CatalogService`/`CatalogMapper` additions) plus its controller e2e spec; the frontend
  shop browse/search/sort/detail pages, wired under the shop-layout route group; and the
  Playwright spec covering all of that signed-out. Fixed a pre-existing gap in
  `AuthGuard`: `@Public()`/`@Optional()` were only read off the route handler, so a
  class-level `@Public()` (the design this feature and the plan call for) silently had no
  effect — switched both to `getAllAndOverride` against handler + class, matching how
  `@AdminOnly()`/`@MemberScoped()` already work. Extended `E2eSeeder`'s catalogue fixtures
  to cover every ordering mode, a barcode, and a hidden-empty category, mirroring the
  admin-side `CatalogSeeder` change from Phase 1. Used a plain `<select>` for the shop's
  sort control instead of the shadcn `Select` primitive, matching the plain-`<select>`
  pattern the admin product form already uses for supplier/category pickers (no other
  screen in this codebase uses the shadcn `Select` yet).
- Tasks completed: T015, T016, T017, T018, T019, T020, T021, T022, T023, T024, T025, T026
- **Author**: AI (Claude)
- **Files**: apps/api/src/modules/auth/auth.guard.ts,
  apps/api/src/modules/catalog/contracts/shop-catalog.contract.ts,
  apps/api/src/modules/catalog/{catalog.service,catalog.mapper,catalog.module,shop-catalog.controller}.ts,
  apps/api/src/modules/catalog/tests/shop-catalog.controller.e2e-spec.ts,
  apps/api/src/seeders/{e2e.seeder,e2e.fixtures}.ts,
  apps/web-spa/app/features/shop/**, apps/web-spa/app/routes.ts,
  apps/web-spa/app/lib/i18n/locales/{en,fr}/common.locales.*.json,
  apps/web-spa-e2e/{env.ts,tests/shop-catalog.spec.ts}, packages/openapi-generator/client/*

## [2026-09-04 00:00] - /speckit.implement

### Changed

- Completed Phase 4: User Story 2 (build a cart). Added the `/cart/*` API (contract,
  `CartService`, `CartController`, mapper additions) with 12 controller e2e tests covering
  merge-on-repeat-add, the `409`/`422` validation rules, ownership 404s, and a line whose
  product's ordering mode was narrowed after it was added coming back `isValid: false`
  instead of being dropped. Fixed a MikroORM gap surfaced by the "remove a line" test:
  `Cart.lines` needed `orphanRemoval: true`, since `CartLine.cart` is required — without it,
  removing a line from the collection violated the FK instead of deleting the row. Added the
  frontend cart: the add-to-cart form (redirects a signed-out visitor to `/login?redirect=`,
  which the login page now honors after sign-in), the cart page (quantity stepper, remove
  with an `AlertDialog` confirmation, running total, invalid-line badges), a cart-count badge
  in both the shop and member-area headers, and the `/cart` route. Used the same plain-button
  toggle pattern as the rest of the app for the ordering-mode picker (shown only when a
  product supports `both`) instead of the shadcn `RadioGroup`, matching Phase 3's shadcn
  `Select` deviation for the same reason — no other screen in this codebase uses it yet.
  Playwright spec covers add/adjust/remove, the `both`-product ordering-type choice, and the
  signed-out redirect; full existing Playwright suite still green.
- Tasks completed: T027, T028, T029, T030, T031, T032, T033, T034, T035, T036, T037, T038
- **Author**: AI (Claude)
- **Files**: apps/api/src/modules/orders/{cart.controller,cart.service,orders.mapper,orders.module}.ts,
  apps/api/src/modules/orders/contracts/cart.contract.ts,
  apps/api/src/modules/orders/entities/cart.entity.ts,
  apps/api/src/modules/orders/tests/orders.controller.e2e-spec.ts,
  apps/web-spa/app/features/cart/**, apps/web-spa/app/features/shop/components/shop-product-detail-page.tsx,
  apps/web-spa/app/features/common/components/{shop-layout,member-area-layout}.tsx,
  apps/web-spa/app/features/auth/pages/auth-login-page.tsx, apps/web-spa/app/routes.ts,
  apps/web-spa/app/lib/i18n/locales/{en,fr}/common.locales.*.json,
  apps/web-spa-e2e/tests/cart.spec.ts, packages/openapi-generator/client/*

## [2026-09-04 00:00] - /speckit.implement

### Changed

- Completed Phase 5: User Story 3 (check out and place an order). Extended
  `order.contract.ts` with `orderLineSchema`/`orderSchema`/`orderDetailSchema`/
  `checkoutResultSchema`; implemented `OrdersService.checkout` (groups the cart's still-
  orderable lines by ordering type, creates one `Order` + its `OrderLine`s per group with a
  price snapshot taken at checkout — not the price the cart showed — drops the rest with a
  reason, refuses with `409` when nothing valid remains, empties the cart, all in one
  transaction) and wired `POST /cart/checkout`; 5 new controller e2e cases (mixed-cart
  split, empty-cart `409`, price-change-at-checkout, archived-product drop, inactive-member
  `403` leaving the cart untouched) — 17/17 orders tests green. Added the checkout
  confirmation UI (per-order summary, ordering-type-specific "what happens next" copy) and
  wired the checkout action into the cart page.
  Deviation: skipped `pnpm generate` (T045) — the shared dev API used to fetch the OpenAPI
  spec also serves another in-progress session's uncommitted catalog work, and regenerating
  now would have pulled ~900 unrelated lines into the checked-in client. Hand-wrote the
  `checkout()` call and its response types in `cart-queries.ts` against the same
  `checkoutResultSchema` shape as a stand-in; swap it for the generated
  `cartControllerCheckout` call next time a clean regenerate is possible.
  Full existing Playwright suite (23 specs run) plus the full API suite (108 tests) still
  green — no regressions from either phase's changes.
- Tasks completed: T039, T040, T041, T042, T043, T044, T045 (partial, see above), T046, T047
- **Author**: AI (Claude)
- **Files**: apps/api/src/modules/orders/{orders.service,orders.mapper,cart.controller}.ts,
  apps/api/src/modules/orders/contracts/order.contract.ts,
  apps/api/src/modules/orders/tests/orders.controller.e2e-spec.ts,
  apps/web-spa/app/features/cart/components/{checkout-confirmation,cart-page}.tsx,
  apps/web-spa/app/features/cart/utils/cart-queries.ts,
  apps/web-spa/app/lib/i18n/locales/{en,fr}/common.locales.*.json,
  apps/web-spa-e2e/tests/checkout.spec.ts

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
