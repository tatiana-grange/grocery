# Quickstart: Distribution (lot 4)

How to run the feature locally and walk through the seven user stories.

## Prerequisites

- Node 24.13.0, pnpm 10.28.2, Docker running.
- Lots 1–3 merged. This feature reads the `catalog` (lot 1), the pending orders and their
  checkout price snapshots (lot 2), and the stock plus the `OrderLine.fulfilledAt` marker
  lot 3 sets when a pre-order's goods arrive.

## Start the stack

```bash
pnpm docker:up                       # PostgreSQL + MailDev
pnpm --filter=api db:fresh:seed      # rebuild schema from entities + seed
pnpm dev                             # API + web-spa in watch mode
```

- API: `http://localhost:<API_PORT>` — OpenAPI at `/docs`.
- SPA: `http://localhost:5173`.

Regenerate the typed client whenever a contract changes — and this lot changes an existing
one, `stockSummarySchema.quantityOnHand` (research.md §6):

```bash
pnpm generate
```

## Seed data

Extend the lot 1–3 seeder with:

- A **distributor** account (`member,distributor`) and an **admin** account, to see the role boundary.
- A member with a **funded balance** (a `payment_received` entry) holding both a pre-order
  whose goods have been received and an in-store order — the happy path.
- A member with a **zero balance** holding a ready order — the refusal path.
- A member with a pre-order whose goods have **not** been received — the "not ready" path.
- A by-weight product on one of those orders, so the scale input and FR-012 are exercised.
- A **terminated** member holding an order, for FR-005.

## Walk through the user stories

### US1 — Find a member and see what they have to collect (P1)

1. Sign in as the distributor and open `/distribution`.
2. Search the funded member by name, then again by membership number — both find them.
3. Their screen shows both orders, their balance, and their status.
4. The member with an unreceived pre-order shows that line as not ready, with a reason, and
   the validate action disabled (FR-003).
5. A member with nothing outstanding shows an empty state and the express-order button.

### US2 — Hand over an order and charge the member (P1)

1. Open the funded member's ready order.
2. Reduce one line's quantity, set another to zero, put a weight on the by-weight line.
3. Watch the total recalculate at the **checkout** prices, not today's prices (FR-007).
4. Validate. The order is marked handed over, the balance drops by exactly the adjusted
   total, and each product's stock falls by exactly what was handed over.
5. Check `/admin/inventory/products/:productId/stock` — a new negative movement, traceable to
   the handover, and the **weighted average cost price is unchanged** (research.md §5).
6. Try to validate the same order again — refused (FR-011).

### US3 — Express order at the table (P1)

1. From any member's screen, start an express order.
2. Add a product by name, then one by barcode. Add a by-weight product and enter a weight.
3. Add a quantity above the recorded stock — a warning appears, the line stays (FR-018).
4. Remove a line, change a quantity: nothing is persisted yet (FR-016).
5. Validate. A new in-store order exists, already handed over; stock fell; the balance fell.

### US4 — Balance, history, and putting money in (P1)

1. On the zero-balance member, try to hand over their ready order — refused, with the
   shortfall shown, and nothing charged or moved (FR-027).
2. Record a cash payment for the shortfall, then validate again — it goes through (SC-011).
3. Record a cheque and a transfer payment; both appear in the history with their means.
4. Sign in as that member and open `/account` — the same balance and the same movements.
5. Confirm a member cannot read another member's wallet (FR-023).

### US5 — Work through the waiting lists (P2)

1. Open the pre-orders list and the in-store list — the outstanding orders of each kind.
2. Filter by date (FR-033).
3. Open a row: it lands on that member's distribution screen.
4. Hand the order over, come back: it has left the list (FR-032).

### US6 — Correct a handover validated by mistake (P2)

1. Open a validated handover and reverse it, giving a reason.
2. The balance and every touched product's stock return to exactly their prior values,
   **including the weighted average cost price**.
3. The original handover and its charge are still there, unchanged, alongside the reversal
   (FR-028, SC-007).
4. The order is back to pending and can be handed over again (FR-030).

### US7 — The `distributor` role (P2)

1. As the distributor, `/distribution` works and a handover completes.
2. As the distributor, `/admin/members`, `/admin/catalog`, `/admin/purchasing`, and
   `/admin/inventory` all refuse (FR-036).
3. As a plain member, `/distribution` refuses (FR-035).
4. As an admin, `/distribution` works too (FR-035).
5. As an admin, grant and remove `distributor` on a member and watch their access change
   (FR-037).

## Tests

```bash
pnpm --filter=api test               # includes distribution + wallet unit and e2e specs
pnpm lint && pnpm typecheck
pnpm e2e                             # full Playwright suite — must pass in full
```

Expected new API specs:
`distribution/tests/distribution.controller.e2e-spec.ts` (screen reads, handover, express
order, reversal, waiting lists, role boundary — every route in
`contracts/distribution-api.md`);
`distribution/tests/distribution.service.spec.ts` (handover total from adjusted quantities at
snapshot prices, the insufficient-balance comparison including the exact-match boundary, the
not-ready refusal, order settlement, the reversal returning stock and balance to their prior
values);
`wallet/tests/wallet.controller.e2e-spec.ts` (staff and member routes, the
other-member refusal);
`wallet/tests/wallet.service.spec.ts` (balance derivation, the zero-movement member);
`inventory/tests/inventory.service.spec.ts` — **extended**: receive at two different costs,
issue some, assert the weighted average is unchanged (research.md §5), and assert a negative
stock level reads back correctly.

Plus new Playwright specs under `apps/web-spa-e2e/tests/`: `distribution-screen`,
`distribution-handover`, `distribution-express`, `distribution-wallet`,
`distribution-reversal`, and `rbac-distributor`.

The E2E suite also needs a `distributor` role fixture — `E2E_USERS`, the `Role` union in
`apps/web-spa-e2e/env.ts`, `withRole` in `fixtures.ts`, and the loop in `auth.setup.ts`
(research.md §14).

## Moving to migrations

```bash
pnpm --filter=api db:migrate:create
# review apps/api/src/modules/db/migrations/Migration<timestamp>.ts
pnpm --filter=api db:migrate:up
```

Check specifically that:

- `walletEntry`, `handover`, and `handoverLine` are created with their indexes;
- `stockMovement.handoverLineId` is **added** as a nullable column, not a destructive rewrite
  of the existing table;
- nothing touches `order.status`, `stockMovement.reason`, or the roles — all three are
  varchar columns whose allowed values live in the contract enums, so a correct migration
  contains no DDL for them.

`db:fresh:seed` is a local reset only — never run it against a shared database.
