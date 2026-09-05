# Phase 0 Research: Shop and Orders

The spec left no `[NEEDS CLARIFICATION]` markers. This document resolves the technical
decisions the plan still had to make to turn the spec's assumptions into a concrete
design — each one a real fork with more than one reasonable answer.

---

## 1. Where does `orderingMode` live?

**Decision**: A new `orderingMode` field (`'pre_order' | 'in_store' | 'both'`) directly
on the `catalog` module's `Product` entity and contract, admin-editable from the existing
product form.

**Rationale**: It is a fact about the product ("how is this sold"), the same category of
fact as `saleMode` (unit vs weight) which already lives on `Product`. Keeping it there
means one admin product form, one source of truth, and no join for the shop's product
list to know how to label a product.

**Alternatives considered**:
- A separate `orders`-module table keyed by `productId` (e.g. `ProductOrderingSetting`).
  Rejected: adds a join to every catalogue read (shop listing, cart line validation,
  order-line snapshot) for a single-column fact, and a second admin screen to manage it.
- Making it a property of the *cart line* instead of the product (member picks freely
  every time). Rejected: doesn't match the domain — whether something can be pre-ordered
  from a producer or bought from the shelf is a fact about the product's supply, decided
  by an admin, not a shopper's preference. The spec already treats it this way (FR-006:
  "the system MUST show ... which ordering type(s) it is available under").

**Migration**: add the column `NOT NULL` with existing lot 1 seed/demo products backfilled
to `'in_store'` (the safer default — it does not promise a producer delivery that was
never configured). Reviewed as part of the lot's migration, per the project's "review
generated SQL" rule.

---

## 2. Cart as its own entity vs. cart = a draft order

**Decision**: `Cart`/`CartLine` are separate entities from `Order`/`OrderLine`, exactly as
named in the spec's Key Entities section.

**Rationale**: An `Order` is scoped to a single ordering type (FR-014); a cart is not (it
holds both pre-order and in-store lines at once, per US2). Modelling the cart as an
`Order` with a nullable `orderingMode` would put `orderingMode` behind an "only set after
checkout" convention entity-wide, which is more confusing than two small entities with
a clear checkout-time handoff (cart lines become order lines, grouped by type).

**Alternatives considered**: Single `Order` entity with a `status: 'draft' | 'pending' |
'cancelled'` and `orderingMode` nullable while draft. Rejected for the reason above, and
because it would let a "draft" accidentally match order-history or admin queries meant for
placed orders unless every query remembers to exclude `draft`.

---

## 3. Quantity representation for by-weight products

**Decision**: One `quantity` numeric column on `CartLine` and `OrderLine`
(`@Property({ type: 'decimal', precision: 10, scale: 3 })`), meaning "piece count" when
the product's `saleMode` is `unit` and "kilograms" when it is `weight`. Contract-level
validation: `unit` mode requires an integer ≥ 1; `weight` mode requires a positive number
with at most 3 decimal places (gram precision), matching `ProductPrice`'s existing
per-kilogram pricing.

**Rationale**: Reuses the `saleMode` distinction lot 1 already made instead of inventing a
second one. Avoids two separate columns (`unitQuantity` / `weightKg`) that would always be
mutually exclusive per row.

**Alternatives considered**: Store weight in grams as an integer. Rejected: the product's
price and the member-facing UI both already work in kilograms (`ProductPricingUnit =
'kg'`); converting back and forth at every boundary is more error-prone than one decimal
column.

---

## 4. What checkout does with a mixed cart

**Decision**: Group the cart's lines by `orderingMode`; create one `Order` per group
present (so a cart with both types produces two orders in one transaction); empty the
cart; return every created order plus a list of any lines dropped because the product
became unorderable since it was added (FR-012, US3 scenario 5).

**Rationale**: Directly implements the spec's Assumptions section, itself grounded in the
feature inventory's separate "pre-orders to distribute" / "in-store orders to distribute"
distribution lists (lot 4).

---

## 5. Repeating a past order: merge into the current cart, or replace it?

**Decision**: Merge. Repeating an order adds its still-orderable lines to whatever is
already in the member's cart, summing quantity when a line for the same product + ordering
mode already exists, rather than discarding the current cart contents.

**Rationale**: The spec models exactly one active cart per member (Assumptions). Silently
discarding items a member already chose because they clicked "repeat" on an old order
would be a surprising, hard-to-recover mistake. Merge is the safer default and still
matches the updated acceptance scenario (spec US4 scenario 3 and FR-020), which now
describes merging into the member's current cart; when the cart was empty beforehand — the
common case — the effect is the same as "pre-filled with the same products".

**Alternatives considered**: Replace the cart outright. Rejected for the data-loss risk
above. Could be revisited with a confirmation dialogue if user feedback wants it.

---

## 6. Order status values in lot 2

**Decision**: Contract-level string enum, deliberately left open for later lots to extend
without a breaking change: lot 2 only uses `'pending'` and `'cancelled'`. The enum is
defined once in `orders/contracts/order.contract.ts` and exposed via `.meta()`, the same
pattern lot 1 used for `Roles(...string[])` being generic ahead of the `grocer` role.

**Rationale**: Lot 3 (aggregated into a supplier order) and lot 4 (in distribution,
fulfilled) will add values to this same field rather than introduce a parallel status.
Deciding the enum shape now, even though only two values are used, avoids a lot 3/4
migration that has to map an old status representation onto a new one.

**Consequence for lot 2 testing**: lot 2 exposes no transition that moves an order past
`pending` (only `pending → cancelled`). FR-021's "refuse cancellation once the order has
moved into further processing" branch is therefore verified by seeding a non-`pending`
status directly in the e2e fixture — the guard exists for the statuses lots 3 and 4 add.

---

## 7. Public shop routes: new controllers vs. relaxing the existing ones

**Decision**: New controller classes (`ShopCatalogController` or split
`ShopProductsController` / `ShopCategoriesController`) under `catalog`, class-level
`@Public()`, route prefix `/shop/*`, backed by new `CatalogService` read methods that
filter to non-archived + orderable + (for categories) "has at least one orderable
product." The existing `AdminProductsController` / `AdminCategoriesController` /
`AdminSuppliersController` in `catalog.controller.ts` stay `@AdminOnly()` and untouched. The
new `ShopCatalogController` lives in its own `shop-catalog.controller.ts` so the `@Public()`
surface stays isolated for review — a file-layout deviation from Principle III's one-file
shape, recorded in plan.md's Complexity Tracking.

**Rationale**: The existing controllers are `@AdminOnly()` at the class level and return
admin-shaped data (e.g. full price history, archived items with `?includeArchived=true`).
Relaxing them per-route would mean auditing every admin field for public safety on every
future admin addition. A separate, narrow, public contract (`ShopProduct` /
`ShopCategory`) is easier to keep intentionally small.

**Alternatives considered**: Add `@Public()` to individual GET routes on the admin
controllers. Rejected for the field-leak risk above, and because the admin list
intentionally includes archived/unorderable items which must never reach `/shop/*`.

---

## 8. E2E strategy

**Decision**: Four new Playwright spec files (`shop-catalog.spec.ts`, `cart.spec.ts`,
`checkout.spec.ts`, `orders-history.spec.ts`) under `apps/web-spa-e2e/tests/`, reusing the
existing `.auth/member.json` storage state for signed-in flows and an unauthenticated
context (no storage state) for the public-browsing tests, following the pattern already
used by `catalog-products.spec.ts` and `auth-guards.spec.ts`. `pnpm e2e` must pass in
full before this feature is considered done, per the project's E2E policy — a failing
E2E test blocks the feature until a human decides whether to fix the test or the
behaviour.

**Rationale**: Matches the existing suite's structure one-for-one; no new fixtures or
global setup needed beyond seeding at least one `pre_order`, one `in_store`, and one
`both` product for the tests to exercise.
