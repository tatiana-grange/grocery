# Quickstart: Purchasing (lot 3)

How to run the feature locally and walk through the five user stories.

## Prerequisites

- Node 24.13.0, pnpm 10.28.2, Docker running.
- Lot 1 (`feat/foundation`) and lot 2 (`feat/shop-orders`) already merged — this feature
  builds on the `catalog` module and reads pending pre-orders from the `orders` module.

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

Extend the lot 1/2 seeder with at least:

- One supplier with two `pre_order` (or `both`) products, one unit-sold and one by-weight
  with `averageWeightGrams` / `weightTolerancePercent` set.
- Pending pre-orders from at least two different members for that supplier, with at least
  one shared product between them (to see aggregation sum quantities).
- A pre-order for a product that gets archived before aggregation runs, to exercise the
  "skipped, and why" path (FR-003).

## Walk through the user stories

### US1 — Aggregate pending pre-orders (P1)

1. As admin, trigger aggregation for the seeded supplier
   (`POST /admin/suppliers/:supplierId/purchasing/aggregate`).
2. Open the resulting draft supplier order — one line per distinct product, quantities
   summed across the two members' pre-orders.
3. Trigger aggregation again for the same supplier before sending the first order — refused
   with "nothing pending to aggregate" (FR-004), since there is nothing new yet.
4. Place a new pre-order for the same supplier, then aggregate again — a *second* draft
   order is created with just the new line; the first draft is untouched (FR-005).
5. Confirm the archived-product pre-order was left out of both orders, and is listed as
   skipped with a reason (FR-003).

### US2 — Send a supplier order (P1)

1. Review the first draft order's lines and total.
2. Mark it sent — status becomes `sent`; check the export endpoint returns a readable
   summary.
3. Try to mark it sent again — refused (FR-008).
4. Aggregate the supplier again — the new draft picks up only newly pending pre-orders, not
   anything already on the sent order.

### US3 — Receive a delivery, watch stock and cost price update (P1)

1. Record a reception on the sent order: one line matching the ordered quantity exactly,
   one line short by a few units, and the by-weight line with a received weight slightly
   off its estimate (within tolerance) — confirm the short line is flagged and the
   by-weight line is not flagged as a discrepancy (research.md §5).
2. Check `GET /admin/inventory/products/:productId/stock` for each received product — stock
   increased by exactly the received amount, and each shows a cost price.
3. Try recording a reception against a `draft` order — refused (FR-015).
4. Record a second, later reception against the same sent order for the remainder of the
   short line — stock and cost price update again, on top of the first reception; both
   receptions remain visible in the order's history (FR-013).
5. Confirm a mistake in the second reception by recording a third, correcting reception —
   the earlier ones are never edited (FR-014).

### US4 — Check a product's current stock and cost price (P2)

1. `GET /admin/inventory/stock` — lists every product; the never-received one shows
   `quantityOnHand: 0`, `costPriceEur: null` (FR-020).
2. Open the received product's detail — stock level, cost price, and the full movement
   list, each traceable to its reception (SC-003).
3. If the product was received twice at different unit costs, confirm the cost price is
   the quantity-weighted average of both (research.md §4).

### US5 — Close out a supplier order that will not be fully honored (P2)

1. On a sent order with a line still short after all expected deliveries, close it —
   status becomes `closed`; the stock and cost price already recorded stay untouched.
2. Try recording a further reception against it — refused (FR-022).
3. Confirm a fully-received order (US3) shows status `received`, distinguishing it from the
   `closed` one (FR-023).

## Tests

```bash
pnpm --filter=api test               # includes purchasing + inventory unit and e2e specs
pnpm lint && pnpm typecheck
pnpm e2e                             # full Playwright suite — must pass in full
```

Expected new API specs:
`purchasing/tests/purchasing.controller.e2e-spec.ts` (aggregation, send, receptions,
close — all routes from `contracts/purchasing-api.md`);
`purchasing/tests/purchasing.service.spec.ts` (aggregation grouping/sum, discrepancy
tolerance for by-weight products, fulfillment marking, status transitions);
`purchasing/tests/purchasing.mapper.spec.ts`;
`inventory/tests/inventory.controller.e2e-spec.ts` (stock/cost reads, never-received
product);
`inventory/tests/inventory.service.spec.ts` (stock-level and weighted-average-cost
aggregate queries). Plus new Playwright specs under `apps/web-spa-e2e/tests/`
(`admin-purchasing-aggregate`, `admin-purchasing-reception`, `admin-inventory-stock`).

## Moving to migrations

```bash
pnpm --filter=api db:migrate:create
# review apps/api/src/modules/db/migrations/Migration<timestamp>.ts
pnpm --filter=api db:migrate:up
```

Check specifically that `orderLine.supplierOrderLine` and `orderLine.fulfilledAt` are added
as nullable columns on the existing `orderLine` table (not a destructive rewrite), and that
the new `supplierOrder`, `supplierOrderLine`, `reception`, `receptionLine`, and
`stockMovement` tables carry the foreign keys described in `data-model.md`.
