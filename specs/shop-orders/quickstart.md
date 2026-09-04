# Quickstart: Shop and Orders (lot 2)

How to run the feature locally and walk through the five user stories.

## Prerequisites

- Node 24.13.0, pnpm 10.28.2, Docker running.
- Lot 1 (`feat/foundation`) already merged — this feature builds on the `members` and
  `catalog` modules.

## Start the stack

```bash
pnpm docker:up                       # PostgreSQL + MailDev
pnpm --filter=api db:fresh:seed      # rebuild schema from entities + seed
pnpm dev                             # API + web-spa in watch mode
```

- API: `http://localhost:<API_PORT>` — OpenAPI at `/docs`.
- SPA: `http://localhost:5173`.

Regenerate the typed client whenever a contract changes:

```bash
pnpm generate
```

## Seed data

Extend the lot 1 catalogue seeder with at least:

- One `pre_order`-only product (e.g. a producer vegetable).
- One `in_store`-only product.
- One `both` product, to exercise the "member picks the ordering type" path.
- A category with only archived products, to verify it stays hidden from `/shop`.

## Walk through the user stories

### US1 — Browse and find products (P1)

1. As a visitor (no sign-in), open `/shop`. Products are grouped by category; the
   archived-only category is absent.
2. Search by the seeded product's name, then again by its barcode — same product both
   times.
3. Change the sort order — list re-orders.
4. Open a product — photos, description, current price, sale unit, and labels show; the
   ordering-type badge (pre-order / in-store / both) is visible.

### US2 — Build a cart (P1)

1. Still signed out, try to add a product to the cart → redirected to `/login` with a
   "come back to this product after signing in" affordance.
2. Sign in as a member. Add the `pre_order` product and the `in_store` product to the
   cart with different quantities.
3. Add the `both` product, choosing `in_store` this time.
4. Open `/cart` — three lines, correct ordering-type labels, correct running total.
5. Change one line's quantity, remove another — total updates immediately.

### US3 — Check out (P1)

1. From `/cart`, confirm checkout. Two orders are created (one `pre_order`, one
   `in_store` — the two ordering types present). The cart is now empty.
2. Each order confirmation shows its lines, total, ordering type, and the plain-language
   "what happens next" text.
3. As admin, change the price of a product, then as the member add it to the cart and
   check out — the order shows the price actually charged, not a stale one.
4. As admin, archive a product that's sitting in the member's cart, then check out as the
   member — that line is dropped with a clear message; the rest of checkout succeeds.

### US4 — Order history and repeat (P2)

1. `/orders` lists both orders from US3, with status, ordering type, and total.
2. Open one — full line detail.
3. Repeat it — its still-orderable lines merge into your current cart at current prices
   (quantities add up on a line already there); if a line's product is no longer orderable,
   you are told which one was skipped.

### US5 — Cancel a pending order (P2)

1. From `/orders/:id` on a `pending` order, cancel it — status becomes `cancelled`,
   excluded from further processing.
2. Manually move an order past `pending` (or simulate via a direct DB update, since lot 3
   doesn't exist yet) and confirm cancel is refused with an explanation.

## Tests

```bash
pnpm --filter=api test               # includes catalog + orders unit and e2e specs
pnpm lint && pnpm typecheck
pnpm e2e                             # full Playwright suite — must pass in full
```

Expected new API specs: `catalog/tests/shop-catalog.controller.e2e-spec.ts`;
`orders/tests/orders.controller.e2e-spec.ts` (covers both the `/cart/*` and `/orders/*`
routes — one e2e file for the module); `orders/tests/orders.service.spec.ts` (checkout
split, price snapshot, weight quantity validation, repeat-order merge);
`orders/tests/orders.mapper.spec.ts`. Plus the four new Playwright specs under
`apps/web-spa-e2e/tests/` (`shop-catalog`, `cart`, `checkout`, `orders-history`).

## Moving to migrations

```bash
pnpm --filter=api db:migrate:create
# review apps/api/src/modules/db/migrations/Migration<timestamp>.ts
pnpm --filter=api db:migrate:up
```

Check specifically that `product.orderingMode` is added as `NOT NULL` with the
`'in_store'` backfill applied to existing rows in the same migration, not as a nullable
column to be tightened later.
