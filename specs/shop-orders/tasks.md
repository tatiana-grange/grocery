---
description: "Task list for the Shop and Orders feature (lot 2)"
---

# Tasks: Shop and Orders — Public Catalogue, Cart, Pre-order vs In-store Order

**Input**: Design documents from `/specs/shop-orders/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included. The project constitution requires at least one controller e2e test per
API module and unit tests for money / by-weight logic, so those test tasks are mandatory,
not optional.

**E2E tests**: The project has a Playwright suite (`apps/web-spa-e2e`, `pnpm e2e`). Every
user story phase below includes at least one Playwright task covering that story's primary
flow, written to fail before the story is implemented. The Polish phase runs the full suite.
Never edit, skip, or delete an existing E2E test — if one breaks, a human decides whether to
update the test or fix the code.

**Organization**: Tasks are grouped by user story. Setup and Foundational phases unblock
every story; US1, US2, US3 build on each other in the order a shopper actually moves through
the shop (browse → cart → checkout), so treat them as sequential even though each has its
own independently-testable slice. US4 and US5 extend the `orders` surface US3 creates.

## Path Conventions

- Backend, extended module: `apps/api/src/modules/catalog/...`
- Backend, new module: `apps/api/src/modules/orders/...`
- Frontend: `apps/web-spa/app/features/<feature>/...`
- Playwright e2e: `apps/web-spa-e2e/tests/...`
- Generated client: `packages/openapi-generator/` (refreshed with `pnpm generate`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The catalogue-side prerequisite every story needs (a product's ordering
mode), demo data to exercise it, and empty i18n namespaces.

- [X] T001 Create the `orders` module skeleton directories (`entities/`, `contracts/`,
      `tests/`) under `apps/api/src/modules/orders/`
- [X] T002 [P] Add `productOrderingModeSchema` (`pre_order` \| `in_store` \| `both`) and an
      `orderingMode` field to `apps/api/src/modules/catalog/contracts/product.contract.ts`
      (`productSchema`, required on `createProductSchema`, optional on `updateProductSchema`)
      and to `apps/api/src/modules/catalog/entities/product.entity.ts`
- [X] T003 [P] Extend `apps/api/src/modules/catalog/catalog.seeder.ts`: set `orderingMode`
      on the existing lot 1 demo products (default `in_store`), add one `pre_order`-only,
      one `in_store`-only, and one `both` product, and a category whose only product is
      archived (for the "hidden empty category" scenario)
- [X] T004 [P] Create empty i18n namespaces `shop`, `cart`, `orders` under
      `apps/web-spa/app/lib/i18n/locales/en/` and `apps/web-spa/app/lib/i18n/locales/fr/`
- [X] T005 Run `pnpm --filter=api db:fresh:seed` to apply the `orderingMode` column and the
      new seed data (depends on T002, T003)

**Checkpoint**: Every product carries an ordering mode; demo data covers all three values.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The `Cart`/`CartLine`/`Order`/`OrderLine` entities, the shared order enums,
the `orders` module skeleton, and the public shop shell. No user story can start until
this is done.

**⚠️ CRITICAL**: Blocks every user story.

- [X] T006 [P] Create `Cart` entity in `apps/api/src/modules/orders/entities/cart.entity.ts`
      (`member` ManyToOne unique, `version`, audit)
- [X] T007 [P] Create `CartLine` entity in
      `apps/api/src/modules/orders/entities/cart-line.entity.ts` (`cart`, `product`,
      `orderingMode`, `quantity` decimal(10,3); unique `(cart, product, orderingMode)`)
- [X] T008 [P] Create `Order` entity in `apps/api/src/modules/orders/entities/order.entity.ts`
      (`member`, `orderingMode`, `status`, `totalAmountCents`, `currency`, `placedAt`,
      `cancelledAt` nullable, `version`, audit)
- [X] T009 [P] Create `OrderLine` entity in
      `apps/api/src/modules/orders/entities/order-line.entity.ts` (`order`, `product`,
      `productNameSnapshot`, `quantity`, `unitPriceAmountCents`, `lineTotalAmountCents`,
      `createdAt` only — immutable snapshot, no `updatedAt`; this audit-field deviation is
      recorded in plan.md Complexity Tracking)
- [X] T010 Create `apps/api/src/modules/orders/contracts/order.contract.ts` with the two
      shared enums (`orderingModeChoiceSchema` = `pre_order` \| `in_store`, used by cart
      lines and orders; `orderStatusSchema`), each with `.meta()` and an exported inferred
      type (depends on T006–T009)
- [X] T011 Create `orders.module.ts` (no controllers yet), `cart.service.ts` and
      `orders.service.ts` skeletons (constructor + `EntityManager`), and `orders.mapper.ts`
      skeleton in `apps/api/src/modules/orders/` (depends on T006–T010)
- [X] T012 Register `OrdersModule` in `apps/api/src/app.module.ts` (depends on T011)
- [X] T013 Run `pnpm --filter=api db:fresh:seed` to create the `cart`, `cartLine`, `order`,
      `orderLine` tables (depends on T012)
- [X] T014 [P] Create `apps/web-spa/app/features/common/components/shop-layout.tsx`: a
      public shell (no session redirect) with links to the shop and cart, a cart-item-count
      badge and account link when signed in, and a sign-in/register link when signed out

**Checkpoint**: The data model and module skeleton exist; the public shop has a shell to
render into.

---

## Phase 3: User Story 1 - Browse and find products in the public shop (Priority: P1) 🎯 MVP

**Goal**: A visitor browses the catalogue by category, searches by name or barcode, sorts
the list, and opens a product's detail page — all without signing in. Categories with no
orderable product are hidden.

**Independent Test**: As a signed-out visitor, look up a known product by name and by
barcode, browse a category, and confirm the archived-only category from T003 does not
appear.

### Tests for User Story 1

- [X] T015 [P] [US1] Create
      `apps/api/src/modules/catalog/tests/shop-catalog.controller.e2e-spec.ts` covering:
      `/shop/categories` excludes the archived-only category; `/shop/products` excludes
      archived products and supports `q` (name and barcode) and sort; `/shop/products/:id`
      returns photos, description, current price, sale unit, labels, `orderingMode`; `404`
      on an archived or unknown id; every route reachable with no `Authorization` header
- [X] T016 [US1] E2E test for browsing, searching, sorting, and the hidden-empty-category
      rule in `apps/web-spa-e2e/tests/shop-catalog.spec.ts` (no auth fixture — signed-out
      context), written to fail before the shop page exists

### Implementation for User Story 1

- [X] T017 [P] [US1] Create `apps/api/src/modules/catalog/contracts/shop-catalog.contract.ts`
      (`shopCategorySchema`, `shopProductSchema`, `shopProductDetailSchema`,
      `enabledShopProductSortingKeys`, `enabledShopProductFilteringKeys`), each schema with
      `.meta()` and an exported inferred type
- [X] T018 [US1] Add `listShopCategories`, `listShopProducts`, `getShopProductDetail` to
      `apps/api/src/modules/catalog/catalog.service.ts` (non-archived only; a category is
      included only if it has ≥1 non-archived product) (depends on T017)
- [X] T019 [US1] Add `toShopProduct` / `toShopProductDetail` / `toShopCategory` to
      `apps/api/src/modules/catalog/catalog.mapper.ts` (depends on T017)
- [X] T020 [US1] Create `apps/api/src/modules/catalog/shop-catalog.controller.ts`,
      class-level `@Public()`, per `contracts/shop-catalog-api.md`: `GET /shop/categories`,
      `GET /shop/products`, `GET /shop/products/:id`; register it on `CatalogModule`
      (depends on T018, T019)
- [X] T021 [US1] Run `pnpm generate` (depends on T020)
- [X] T022 [P] [US1] Create `apps/web-spa/app/features/shop/utils/shop-queries.ts`
      (categories, product list with `categoryId`/`q`/sort/page, product detail) (depends
      on T021)
- [X] T023 [P] [US1] Create `apps/web-spa/app/features/shop/components/product-card.tsx`
      and `apps/web-spa/app/features/shop/components/category-filter.tsx` (shadcn `Card`,
      `Badge` for labels and ordering mode)
- [X] T024 [US1] Create `apps/web-spa/app/features/shop/components/shop-page.tsx`: search
      input, sort select, category filter, product grid, empty-state for no results
      (shadcn `Input`, `Select`, `EmptyState` from `@grocery/ui/components/app`) (depends
      on T022, T023)
- [X] T025 [US1] Create
      `apps/web-spa/app/features/shop/components/shop-product-detail-page.tsx` (photos,
      description, price, sale unit, labels, ordering-mode badge) (depends on T022)
- [X] T026 [US1] Add `/shop` and `/shop/products/:productId` routes under a new
      `shop-layout` layout group in `apps/web-spa/app/routes.ts`; fill the `shop` i18n
      namespace (en + fr) (depends on T024, T025, T014)

**Checkpoint**: US1 is a demoable slice — anyone can browse and find products without
signing in.

---

## Phase 4: User Story 2 - Build a cart mixing pre-order and in-store items (Priority: P1)

**Goal**: A signed-in, active member adds products to a cart (choosing the ordering type
when a product offers both), adjusts or removes lines, and sees a running total. A visitor
is prompted to sign in; an inactive member is refused.

**Independent Test**: Sign in as a member, add one pre-order and one in-store product,
adjust a quantity, remove a line, and confirm the total updates each time — without
checking out.

### Tests for User Story 2

- [X] T027 [P] [US2] Create `apps/api/src/modules/orders/tests/orders.controller.e2e-spec.ts`
      covering: `GET /cart` creates an empty cart on first read; `POST /cart/lines` adds a
      line and merges quantity on a repeat add of the same product + ordering mode; `409`
      when the requested `orderingMode` isn't offered by the product; `422` on a
      non-integer quantity for a `unit` product and on >3 decimals for a `weight` product;
      `PUT`/`DELETE /cart/lines/:lineId` update and remove; a line whose product's
      `orderingMode` an admin narrowed after it was added comes back from `GET /cart` with
      `isValid: false` and a reason (not dropped); every route `401` unauthenticated and
      `403` for a pending/rejected/terminated member
- [X] T028 [US2] E2E test for adding, updating, removing cart lines (including a `both`
      product where the member picks the ordering type) and the signed-out redirect-to-login
      prompt in `apps/web-spa-e2e/tests/cart.spec.ts`, written to fail before the cart page
      exists

### Implementation for User Story 2

- [X] T029 [P] [US2] Create `apps/api/src/modules/orders/contracts/cart.contract.ts`
      (`cartLineSchema`, `cartSchema`, `addCartLineSchema`, `updateCartLineSchema`), each
      with `.meta()` and an exported inferred type
- [X] T030 [US2] Implement `CartService` in `apps/api/src/modules/orders/cart.service.ts`:
      `getOrCreateCart`, `addLine` (merge on `(cart, product, orderingMode)`, validate
      `orderingMode` against the product, validate quantity against `saleMode`),
      `updateLine`, `removeLine` (depends on T029)
- [X] T031 [US2] Add `toCartLine` / `toCart` to `apps/api/src/modules/orders/orders.mapper.ts`
      — computes `unitPriceEur`/`lineTotalEur` from the product's current price and
      `isValid`/`invalidReason` from archived/ordering-mode state (depends on T029)
- [X] T032 [US2] Create `apps/api/src/modules/orders/cart.controller.ts`, class-level
      `@MemberScoped()`: `GET /cart`, `POST /cart/lines`, `PUT /cart/lines/:lineId`,
      `DELETE /cart/lines/:lineId`; register it on `OrdersModule` (depends on T030, T031)
- [X] T033 [US2] Run `pnpm generate` (depends on T032)
- [X] T034 [P] [US2] Create `apps/web-spa/app/features/cart/utils/cart-queries.ts` (get
      cart, add/update/remove line mutations) (depends on T033)
- [X] T035 [US2] Create `apps/web-spa/app/features/cart/components/add-to-cart-form.tsx`
      (quantity input, ordering-mode `RadioGroup` shown only when the product supports
      `both`) and wire it into `shop-product-detail-page.tsx`, redirecting a signed-out
      visitor to `/login` with a return path back to the product (depends on T034, T025)
- [X] T036 [US2] Create `apps/web-spa/app/features/cart/components/cart-page.tsx`: line
      list (shadcn `Table`), quantity stepper, remove with `AlertDialog` confirmation,
      running total, invalid-line messaging (depends on T034)
- [X] T037 [P] [US2] Create `apps/web-spa/app/features/cart/hooks/use-cart-count.ts` and
      wire a cart badge into `shop-layout.tsx` and `member-area-layout.tsx` (depends on
      T034)
- [X] T038 [US2] Add the `/cart` route under the existing `member-area-layout` group in
      `apps/web-spa/app/routes.ts`; fill the `cart` i18n namespace (en + fr) (depends on
      T036, T037)

**Checkpoint**: US1 and US2 both work independently — a member can fully build a cart.

---

## Phase 5: User Story 3 - Check out and place an order (Priority: P1)

**Goal**: The member confirms checkout; the cart splits into one order per ordering type
present, each showing its lines, total, and a plain-language "what happens next"; a price
change or an archived product is handled without breaking checkout.

**Independent Test**: With a cart holding a pre-order line and an in-store line, complete
checkout and confirm two separate orders with the right lines, quantities, and totals, and
that the cart is now empty.

### Tests for User Story 3

- [ ] T039 [P] [US3] Extend `orders.controller.e2e-spec.ts` with checkout scenarios:
      mixed cart → two orders, each with its own lines and total; empty cart → `409`;
      a price change between add-to-cart and checkout → the order charges the current
      price; an archived product in the cart → its line is dropped and reported in
      `droppedLines`, the rest of checkout still succeeds; a member whose membership goes
      inactive while items sit in the cart → checkout `403` and the cart's lines are left
      intact (spec edge case)
- [ ] T040 [US3] E2E test for checking out a mixed cart into two order confirmations, and
      for the empty-cart block, in `apps/web-spa-e2e/tests/checkout.spec.ts`, written to
      fail before checkout exists; assert each confirmation renders the ordering-type
      specific "what happens next" copy via its stable `cart` i18n key (pre-order vs
      in-store), not a hardcoded string

### Implementation for User Story 3

- [ ] T041 [P] [US3] Extend `apps/api/src/modules/orders/contracts/order.contract.ts` with
      `orderLineSchema`, `orderSchema`, `orderDetailSchema`, `checkoutResultSchema`
- [ ] T042 [US3] Implement `OrdersService.checkout` in
      `apps/api/src/modules/orders/orders.service.ts`: read the cart's lines, drop
      unorderable ones, refuse if nothing valid remains, group the rest by `orderingMode`,
      create one `Order` + its `OrderLine`s per group with a price snapshot, clear the
      cart's lines — all in one transaction (depends on T041, T008, T009)
- [ ] T043 [US3] Add `toOrder` / `toOrderDetail` / `toOrderLine` to
      `apps/api/src/modules/orders/orders.mapper.ts` (depends on T041)
- [ ] T044 [US3] Add `POST /cart/checkout` to `apps/api/src/modules/orders/cart.controller.ts`
      (depends on T042, T043)
- [ ] T045 [US3] Run `pnpm generate` (depends on T044)
- [ ] T046 [US3] Create
      `apps/web-spa/app/features/cart/components/checkout-confirmation.tsx` (per-order
      summary + next-step copy) and wire the checkout action into `cart-page.tsx` (depends
      on T045, T036)
- [ ] T047 [US3] Fill the checkout strings in the `cart` i18n namespace (en + fr)

**Checkpoint**: US1–US3 all work independently — the shop can take a real order.

---

## Phase 6: User Story 4 - Review order history and repeat a past order (Priority: P2)

**Goal**: A member lists their orders, opens one for full detail, and repeats a past order
by merging its still-orderable lines into their current cart.

**Independent Test**: Place an order, then repeat it from order history and confirm its
still-orderable lines are merged into the member's current cart at current prices,
independent of any other story's flow.

### Tests for User Story 4

- [ ] T048 [P] [US4] Extend `orders.controller.e2e-spec.ts`: `GET /orders` lists only the
      caller's own orders, filterable by `status`/`orderingMode`; `GET /orders/:id` returns
      full line detail and `404`s for another member's order; `POST /orders/:id/repeat`
      merges into the existing cart (summing quantity on a line already present) and lists
      any skipped, now-unorderable lines
- [ ] T049 [US4] E2E test for viewing order history, opening an order's detail, and
      repeating it into the cart in `apps/web-spa-e2e/tests/orders-history.spec.ts`,
      written to fail before the order-history pages exist

### Implementation for User Story 4

- [ ] T050 [P] [US4] Extend `apps/api/src/modules/orders/contracts/order.contract.ts` with
      `ordersListSchema` (pagination + `status`/`orderingMode` filters) and
      `repeatOrderResultSchema`
- [ ] T051 [US4] Add `listOrders`, `getOrderDetail`, `repeatOrder` (merge into the current
      cart, per research.md §5) to `apps/api/src/modules/orders/orders.service.ts` (depends
      on T050)
- [ ] T052 [US4] Create `apps/api/src/modules/orders/orders.controller.ts`, class-level
      `@MemberScoped()`: `GET /orders`, `GET /orders/:id`, `POST /orders/:id/repeat`;
      register it on `OrdersModule` (depends on T051)
- [ ] T053 [US4] Run `pnpm generate` (depends on T052)
- [ ] T054 [P] [US4] Create `apps/web-spa/app/features/orders/utils/orders-queries.ts`
      (list, detail, repeat mutation) (depends on T053)
- [ ] T055 [US4] Create
      `apps/web-spa/app/features/orders/components/orders-list-page.tsx` (shadcn `Table`
      + `Pagination`, status/ordering-mode filter) (depends on T054)
- [ ] T056 [US4] Create `apps/web-spa/app/features/orders/components/order-detail-page.tsx`
      (line detail, repeat action with a skipped-lines toast) (depends on T054)
- [ ] T057 [US4] Add `/orders` and `/orders/:orderId` routes under the existing
      `member-area-layout` group in `apps/web-spa/app/routes.ts`; fill the `orders` i18n
      namespace (en + fr) (depends on T055, T056)

**Checkpoint**: US1–US4 all work independently.

---

## Phase 7: User Story 5 - Cancel a pending order (Priority: P2)

**Goal**: A member cancels an order of theirs while it is still "pending"; cancellation is
refused once it has moved on.

**Independent Test**: Place an order and cancel it while pending — status becomes
cancelled and it drops out of further processing.

### Tests for User Story 5

- [ ] T058 [US5] Extend `orders.controller.e2e-spec.ts`: cancel a `pending` order → status
      `cancelled`; cancel again → `409` "already cancelled"; cancel an order whose status
      has been moved past `pending` → `409` with the "contact the grocery" message (lot 2
      has no API path to that state — the test seeds the status directly in the fixture;
      the guard is defensive for lots 3–4, per research.md §6); stale `version` → `409`
- [ ] T059 [US5] Extend `apps/web-spa-e2e/tests/orders-history.spec.ts` with a cancel
      scenario (cancel a pending order from its detail page; confirm the disabled/blocked
      state once it can no longer be cancelled), written to fail before the cancel action
      exists

### Implementation for User Story 5

- [ ] T060 [US5] Add `cancelOrder` to `apps/api/src/modules/orders/orders.service.ts`
      (status transition guarded to `pending → cancelled`, optimistic `version` check)
      (depends on T051)
- [ ] T061 [US5] Add `POST /orders/:id/cancel` to
      `apps/api/src/modules/orders/orders.controller.ts` (depends on T060)
- [ ] T062 [US5] Run `pnpm generate` (depends on T061)
- [ ] T063 [US5] Add a cancel action with an `AlertDialog` confirmation to
      `order-detail-page.tsx`, disabled once the order is no longer `pending`; the cancel
      mutation sends the loaded order's `version` (per `cancelOrderSchema`) and surfaces a
      `409` as a "reload and try again" message; fill the cancel strings in the `orders`
      i18n namespace (depends on T062, T056)

**Checkpoint**: All five user stories work independently.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Money/weight unit coverage, docs, migration, and the full quality gate.

- [ ] T064 [P] Create `apps/api/src/modules/orders/tests/orders.service.spec.ts`: unit
      tests (Arrange-Act-Assert) for the checkout split-by-ordering-type, the price
      snapshot staying fixed after a later catalogue price change, the `unit`-vs-`weight`
      quantity validation rules, and the repeat-order quantity-merge logic
- [ ] T065 [P] Create `apps/api/src/modules/orders/tests/orders.mapper.spec.ts`: unit
      tests for cart line total / cart total computation and the `isValid`/`invalidReason`
      flag
- [ ] T066 [P] Add a "Shop and Orders" project note at
      `apps/documentation/src/content/docs/project/lot-2-shop-orders.mdx` and regenerate
      `apps/documentation/INDEX.md`
- [ ] T067 Run `.specify/scripts/bash/update-agent-context.sh claude` so `CLAUDE.md` lists
      the `orders` module
- [ ] T068 Generate the lot's migration once the schema is stable: `pnpm --filter=api
      db:migrate:create`, review the SQL (the `orderingMode` column must be `NOT NULL`
      with the `in_store` backfill in the same migration, confirm no DROP+ADD in place
      of a rename, and confirm the `orderLine` table has a `created_at` but no `updated_at`
      column), commit the migration and updated `.snapshot` files
- [ ] T069 Walk through `specs/shop-orders/quickstart.md` end to end — all five user
      stories — and time the four time-boxed success criteria by hand (SC-001 find a
      product, SC-003 mixed-cart checkout, SC-005 repeat an order, SC-007 cancel), noting
      whether each target is met
- [ ] T070 Run the pre-merge gate: `pnpm lint && pnpm typecheck && pnpm test`
- [ ] T071 [P] i18n audit — confirm no hardcoded user-facing strings in the new `shop`,
      `cart`, and `orders` features
- [ ] T072 Run the full E2E suite (`pnpm e2e`) and confirm every existing test still
      passes alongside the four new specs; a failing test blocks the feature until a human
      decides whether to update the test or fix the behaviour

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: needs Setup. Blocks all user stories.
- **User stories (Phases 3–7)**: each needs Foundational. US1 has no story dependencies.
  US2 adds the add-to-cart control onto US1's product detail page, so build it after US1.
  US3 extends `cart.controller.ts` and the cart page US2 creates. US4 and US5 both extend
  the `orders.controller.ts` / `order.contract.ts` / `orders.service.ts` /
  `order-detail-page.tsx` that US3/US4 create, so run them in order (US3 → US4 → US5).
- **Polish (Phase 8)**: after the stories you intend to ship. T068 (migration) should wait
  until the schema stops changing.

### Story dependencies

- **US1 (P1)**: after Foundational. Independent.
- **US2 (P1)**: after Foundational; adds to US1's product detail page.
- **US3 (P1)**: after Foundational; extends US2's cart controller, service, and page.
- **US4 (P2)**: after Foundational; reuses the `Order`/`OrderLine` contracts US3 defines.
- **US5 (P2)**: after Foundational; extends US4's `orders.controller.ts`/`orders.service.ts`
  and order-detail page.

### Within a story

- e2e / unit test tasks first (they will fail until the implementation lands).
- Entities (Foundational) → contracts → service → mapper → controller → `pnpm generate` →
  frontend queries → frontend components → routes + i18n.
- A story is not complete while any of its E2E tests fail.

### Parallel opportunities

- Setup: T002, T003, T004 in parallel.
- Foundational: T006–T009 in parallel; T014 in parallel with backend work.
- US1: T015 alongside T017; T022, T023 in parallel once `pnpm generate` (T021) is done.
- US2: T027 alongside T029; T034, T037 in parallel.
- US4: T048 alongside T050; T054 alongside the rest once `pnpm generate` (T053) is done.
- Backend (US1–US3, sequential by nature of the shopper flow) and later frontend polish
  can still run in parallel across two developers if one stays one story ahead on the API.

---

## Parallel Example: Foundational entities

```bash
Task: "Cart entity in apps/api/src/modules/orders/entities/cart.entity.ts"
Task: "CartLine entity in apps/api/src/modules/orders/entities/cart-line.entity.ts"
Task: "Order entity in apps/api/src/modules/orders/entities/order.entity.ts"
Task: "OrderLine entity in apps/api/src/modules/orders/entities/order-line.entity.ts"
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1 Setup.
2. Phase 2 Foundational.
3. Phase 3 User Story 1.
4. Stop and validate: browse, search by name and barcode, sort, confirm the empty category
   is hidden — all signed out.
5. Demo — the catalogue is customer-facing.

### Incremental delivery

1. Setup + Foundational → foundation ready.
2. US1 → demo (public shop).
3. US2 → demo (cart).
4. US3 → demo (a real order can be placed — MVP for "the shop takes orders").
5. US4 → demo (order history, repeat).
6. US5 → demo (self-service cancel).
7. Polish → migration, docs, quality gate, full E2E suite.

### Parallel team strategy

- Everyone: Setup + Foundational.
- US1 → US2 → US3 form one shopper-flow chain, best kept with one developer (or two
  pairing) since each extends the previous story's files. A second developer can start
  US4/US5's contract and service work as soon as US3's `order.contract.ts` additions land,
  then finish the controller/frontend once US3 is merged.

---

## Notes

- `[P]` = different files, no dependency on an unfinished task.
- Run `pnpm generate` after every contract change and before the matching frontend task.
- While the `orders` schema and the `orderingMode` column move, use `pnpm --filter=api
  db:fresh:seed`; keep the migration (T068) for when they settle.
- `OrderLine` is a snapshot, not a ledger row like `WalletEntry`/`StockMovement` — but treat
  it the same way in practice: written once at checkout, never edited.
- Commit after each task or logical group; stop at any checkpoint to validate a story.
