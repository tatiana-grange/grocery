# Feature Specification: Shop and Orders — Public Catalogue, Cart, Pre-order vs In-store Order

**Feature Branch**: `feat/shop-orders`
**Created**: 2026-09-04
**Status**: Draft
**Input**: User description: "Réalise le LOT 2 : Boutique & commandes — boutique publique, panier, précommande producteur vs commande sur stock."

## Context

This is delivery lot 2 of the participative grocery app (the "Shop and orders" lot in the
architecture plan). It turns the lot 1 catalogue into something people can actually buy
from:

1. **Public shop** — anyone can browse and search the catalogue, not just staff.
2. **Cart** — a signed-in member collects products before committing to an order.
3. **Pre-order vs in-store order** — some products are ordered ahead from the producer for a
   future delivery ("pre-order"); others are bought from what the cooperative currently has
   on the shelf ("in-store"). The shop must keep these apart because they are fulfilled on
   different timelines.

Lot 2 stops before real stock quantities, aggregating pre-orders into a supplier order, the
distribution screen, and any payment or wallet movement — those belong to lots 3 to 5. In
lot 2, placing an order records what a member wants; it does not move money or guarantee
stock is physically available yet.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse and find products in the public shop (Priority: P1)

A visitor opens the shop and browses products grouped by category, or searches by name or
barcode, and sorts the results. A category with no currently orderable product does not
appear. Opening a product shows its photos, description, current price, the unit it is
priced by, and its informational labels (organic, local, vegetarian/vegan).

**Why this priority**: Without browsing there is nothing to discover, and nothing to put in
a cart. This alone makes the catalogue customer-ready, independent of whether anyone has
signed in yet.

**Independent Test**: As a visitor who has not signed in, look up a known product by name
and again by its barcode, browse into a category, and confirm a category with no available
product is absent from the list — all without touching the cart.

**Acceptance Scenarios**:

1. **Given** the catalogue has products across several categories, **When** a visitor opens
   the shop, **Then** products are browsable by category and every listed category has at
   least one currently orderable product.
2. **Given** a category whose only products are archived or otherwise unorderable, **When**
   a visitor opens the shop, **Then** that category does not appear.
3. **Given** a visitor knows a product's name or barcode, **When** they search using it,
   **Then** the matching product appears in the results.
4. **Given** a list of products, **When** a visitor changes the sort order, **Then** the list
   re-orders accordingly.
5. **Given** a product exists, **When** a visitor opens its detail page, **Then** they see
   its photos, description, current price, sale unit (per piece or per kilogram), and
   informational labels.

---

### User Story 2 - Build a cart mixing pre-order and in-store items (Priority: P1)

A signed-in, active member adds products to a cart. The shop tells them, for each product,
whether it is available by pre-order, in-store, or both. The member sets a quantity (or a
weight, for by-weight products) per line, sees a running total, and can change or remove
lines before checking out.

**Why this priority**: The cart is what turns browsing into an intended purchase. Nothing
downstream works without it.

**Independent Test**: Sign in as a member, add one pre-order product and one in-store
product to the cart, adjust a quantity, remove a line, and confirm the cart total updates
correctly at each step — without completing checkout.

**Acceptance Scenarios**:

1. **Given** a signed-in member viewing an orderable product, **When** they add it to the
   cart, **Then** the cart shows the product, its ordering type, the chosen quantity, and
   its line total.
2. **Given** a product sold by weight, **When** a member adds it to the cart, **Then** they
   enter the desired weight and the line total is calculated from the current per-kilogram
   price.
3. **Given** a product offered under both ordering types, **When** a member adds it,
   **Then** they choose which ordering type that cart line is for.
4. **Given** an item already in the cart, **When** the member changes its quantity or
   removes it, **Then** the cart total updates immediately.
5. **Given** a visitor who is not signed in, **When** they try to add a product to the cart,
   **Then** they are prompted to sign in or register, and returned to the product afterward.
6. **Given** a member whose membership is not active, **When** they try to add a product to
   the cart or check out, **Then** the action is refused with a clear explanation.

---

### User Story 3 - Check out and place an order (Priority: P1)

The member reviews their cart and confirms it. Because pre-order and in-store items are
fulfilled differently, checkout produces a separate order per ordering type present in the
cart. The member sees a confirmation for each, in plain language, explaining what happens
next (a pre-order waits for the next producer delivery; an in-store order waits to be
collected and paid for).

**Why this priority**: This is the transaction the whole shop exists for.

**Independent Test**: With a cart containing both a pre-order line and an in-store line,
complete checkout and confirm two separate orders are created, each with the right lines,
quantities, and totals, and that the cart is now empty.

**Acceptance Scenarios**:

1. **Given** a cart with at least one line, **When** the member confirms checkout, **Then**
   one order is created per ordering type present in the cart, and the cart is emptied.
2. **Given** an empty cart, **When** the member tries to check out, **Then** checkout is
   blocked with an explanation.
3. **Given** an order was just placed, **When** the member views the confirmation, **Then**
   they see its lines, quantities, total, ordering type, and a plain-language explanation of
   the next step.
4. **Given** a product's price changed after it was added to the cart but before checkout,
   **When** the member checks out, **Then** the order is placed at the current price and the
   member is shown the price actually charged.
5. **Given** a product in the cart was archived, or is no longer offered under the chosen
   ordering type, before checkout, **When** the member checks out, **Then** that line is
   dropped with a clear message and the rest of checkout proceeds normally.

---

### User Story 4 - Review order history and repeat a past order (Priority: P2)

A member sees every order they have placed, can open one to see its detail, and can add a
past order's items back into their cart to reorder the same things quickly.

**Why this priority**: A real convenience for repeat shopping and a way to check on an
order, but the shop delivers its core value without it.

**Independent Test**: Place an order, then repeat it from order history and confirm its
lines are added to the member's cart at current prices — independent of any other story's
flow.

**Acceptance Scenarios**:

1. **Given** a member has placed at least one order, **When** they open their order history,
   **Then** they see every past and pending order with its status, ordering type, and total.
2. **Given** a past order, **When** the member opens it, **Then** they see its full line
   detail.
3. **Given** a past order, **When** the member chooses to repeat it, **Then** its
   still-orderable products and quantities are added to the member's current cart at current
   prices — increasing the quantity on a cart line already there for the same product and
   ordering type — and the member is told which lines, if any, were skipped because the
   product is no longer orderable.

---

### User Story 5 - Cancel a pending order (Priority: P2)

A member can cancel an order they placed, as long as it has not yet moved past "pending"
into further processing.

**Why this priority**: Lets members fix their own mistakes without asking an admin, but is
not required for the shop to deliver value.

**Independent Test**: Place an order and cancel it while still pending, and confirm its
status becomes cancelled and it drops out of further processing — independent of the other
stories.

**Acceptance Scenarios**:

1. **Given** an order still "pending", **When** the member cancels it, **Then** its status
   becomes cancelled and it is excluded from further processing.
2. **Given** an order that has already moved past pending, **When** the member tries to
   cancel it, **Then** cancellation is refused with an explanation of who to contact instead.

---

### Edge Cases

- What happens when a product supports both ordering types and a member wants some of each?
  Two separate cart lines are allowed, one per ordering type.
- What happens when a product's ordering type is changed by an admin while it sits in a
  member's cart? The cart flags the line as no longer valid the next time it is viewed, with
  an explanation, rather than silently dropping it.
- What happens when a barcode search matches nothing? The shop shows a clear "no match"
  result, not an error.
- What happens when a member enters a zero, negative, or otherwise invalid quantity or
  weight? The system rejects it with a validation message before it can be added.
- What happens when a member tries to repeat an order that is entirely made of products that
  are no longer orderable? The system leaves the cart unchanged, tells the member that
  nothing could be carried over and why, and creates no order.
- What happens when a member's membership becomes inactive after items are already in their
  cart? The cart is preserved but checkout is blocked until the membership is active again.

## Requirements *(mandatory)*

### Functional Requirements

#### Public catalogue browsing

- **FR-001**: The system MUST let anyone, signed in or not, browse the catalogue of
  non-archived, orderable products grouped by category.
- **FR-002**: The system MUST hide from the public catalogue any category that currently has
  no orderable product.
- **FR-003**: The system MUST let a visitor search products by name or barcode.
- **FR-004**: The system MUST let a visitor sort the product list, at minimum by name and by
  how recently a product was added.
- **FR-005**: The system MUST show, on a product's detail page, its photos, description,
  current price, sale unit (per piece or per kilogram), and informational labels.
- **FR-006**: The system MUST show, for each orderable product, which ordering type(s) it is
  available under (pre-order, in-store, or both).

#### Cart

- **FR-007**: The system MUST require a signed-in, active member to add a product to a cart
  or to check out, and MUST otherwise prompt sign-in or registration while preserving the
  visitor's intended product.
- **FR-008**: The system MUST let a member set a quantity for a unit-sold product, or a
  weight for a by-weight product, when adding it to the cart.
- **FR-009**: The system MUST let a member choose the ordering type for a cart line when the
  product supports both pre-order and in-store.
- **FR-010**: The system MUST let a member change the quantity or weight of a cart line, or
  remove it, and MUST recompute the cart total immediately.
- **FR-011**: The system MUST calculate each cart line's total from the product's current
  price at the time it is shown.
- **FR-012**: The system MUST flag or remove a cart line whose product has become
  unorderable (archived, or no longer offered under its chosen ordering type) and MUST
  explain why.

#### Checkout and orders

- **FR-013**: The system MUST refuse to check out an empty cart, with an explanation.
- **FR-014**: The system MUST create one order per ordering type present at checkout (a
  pre-order and, separately, an in-store order, when the cart holds both), each carrying its
  own lines, quantities, and the price in effect at checkout.
- **FR-015**: The system MUST empty the cart once its contents have become order(s).
- **FR-016**: The system MUST show the member a confirmation for each order placed,
  including its lines, total, ordering type, and a plain-language explanation of what
  happens next.
- **FR-017**: The system MUST record every order with a status that starts at "pending" and
  reflects its later progress (for example, cancelled).

#### Order history and cancellation

- **FR-018**: The system MUST let a member see every order they have placed, with its
  status, ordering type, and total.
- **FR-019**: The system MUST let a member open a past or pending order of their own to see
  its full line detail.
- **FR-020**: The system MUST let a member repeat a past order by adding its still-orderable
  lines to their current cart at current prices — merging into an existing cart line for the
  same product and ordering type, never replacing the cart — and MUST tell the member which
  original lines, if any, could not be carried over because the product is no longer
  orderable.
- **FR-021**: The system MUST let a member cancel their own order while it is still
  "pending", and MUST refuse cancellation once the order has moved into further processing,
  explaining what to do instead.

### Key Entities *(include if feature involves data)*

- **Cart**: A signed-in member's in-progress selection of products before checkout. One
  active cart per member. Can hold lines of different ordering types together.
- **Cart line**: A product, a chosen ordering type (pre-order or in-store), and a quantity or
  weight, within a cart.
- **Order**: The record created from a cart at checkout, scoped to a single ordering type
  (pre-order or in-store) for one member. Holds a status (starting at pending), the date
  placed, and a total.
- **Order line**: A snapshot, on an order, of a product, its quantity or weight, and the
  price actually charged — independent of later catalogue price changes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

The four time-boxed criteria (SC-001, SC-003, SC-005, SC-007) are checked by hand during the
quickstart walkthrough; they are not automated.

- **SC-001**: A visitor can find a specific known product, by name or by barcode, in under 30
  seconds.
- **SC-002**: 100% of categories with no currently orderable product are absent from the
  public catalogue view.
- **SC-003**: A member can add a pre-order item and an in-store item to their cart and
  complete checkout, ending with two separate order confirmations, in under 3 minutes.
- **SC-004**: 100% of checkout attempts by someone who is not a signed-in, active member are
  stopped before an order is created.
- **SC-005**: A member can find a past order and repeat it into their cart in under 1 minute.
- **SC-006**: 100% of placed orders keep the price actually charged, unaffected by later
  catalogue price changes.
- **SC-007**: A member can cancel a still-pending order in under 30 seconds, with the change
  reflected in their order history immediately.

## Assumptions

- **Ordering type is a property of the product, set by an administrator**, with three
  possible values: pre-order only, in-store only, or both. When a product supports both, the
  member picks one per cart line. Exactly which module stores this setting is a planning
  decision, not a spec-level one.
- **No real-time stock-quantity check in lot 2.** Quantities on hand, reservations, and
  oversell prevention belong to lot 3 (inventory). An in-store order in lot 2 records what
  the member wants from the shelf; whether it is physically available is confirmed later, at
  distribution (lot 4).
- **Checkout splits a mixed cart into separate orders, one per ordering type**, because
  pre-orders and in-store orders already appear as separate lists in the grocer's
  distribution workflow (per the feature inventory).
- **No delivery or collection date is shown at order time.** Scheduling and aggregating
  pre-orders into a supplier order is lot 3's job; lot 2 only records that the pre-order
  exists and is pending.
- **A cart is not a separately persisted multi-cart concept** — a member has exactly one
  active cart, equivalent in effect to a draft order.
- **An anonymous visitor's cart intent is not preserved across sign-up/sign-in.** They are
  prompted to sign in or register at the moment they try to add a product, and return to
  that product afterward, rather than the system carrying a guest cart through
  authentication.
- **No payment or wallet movement happens at checkout.** Paying for an in-store order and
  debiting the wallet happen at distribution (lot 4); online top-ups are lot 5. Placing an
  order in lot 2 only records intent.
- **Express order (a grocer selling from current stock on the spot) is out of scope.** Per
  the architecture plan it belongs to the distribution module (lot 4), even though the
  feature inventory also mentions it under the shop area.
- **Nutri-score, Nova-score, Eco-score, and member ratings are not part of this lot.** Photos
  and the organic/local/vegetarian/vegan labels already exist from lot 1 catalogue data and
  are shown on the product page; the richer scoring and rating fields are deferred, as lot 1
  itself already noted.
- **Barcode search reuses the barcode field already on the lot 1 product catalogue.**
- **"Orderable" means "not archived" in lot 2.** Every non-archived catalogue product can be
  browsed and ordered; there is no separate availability flag and no stock check before
  lot 3. A category counts as empty — and is hidden from the shop — when all of its products
  are archived.
- **Lot 2 has no way to advance an order past "pending".** The only status change lot 2
  makes is "pending" → "cancelled". FR-021's rule that cancellation is refused once an order
  has "moved into further processing" is defensive behaviour for the statuses lots 3 and 4
  add; in lot 2 it can only be exercised by setting the status directly in a test.

## Dependencies

- Requires the lot 1 catalogue (suppliers, categories, products, prices) and the member /
  active-membership model.
- Lot 3 (purchasing) will read pending pre-orders to aggregate them into a supplier order.
- Lot 4 (distribution) will read pending in-store and pre-order orders to build its
  distribution lists, and will debit the wallet at that point.

## Out of Scope

- Real-time stock quantities, reservations, oversell prevention, weighted average cost price,
  and inventory counts (lot 3).
- Aggregating pre-orders into a supplier order, reception, and reception discrepancies
  (lot 3).
- Distribution screen, express order, wallet debit, the grocer role, and supplier portal
  (lot 4).
- Online payment, wallet top-up, and payment-provider integration (lot 5).
- Nutri-score, Nova-score, Eco-score, and member product ratings.
- Support tickets and platform messaging between the grocery and members.
- Participation planning, accounting exports, and every item already out of scope for the
  whole app (multi-site hosting, cooperative directory, group orders between cooperatives,
  announcements, services/hour-exchange, BAR module).
