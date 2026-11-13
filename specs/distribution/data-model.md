# Phase 1 Data Model: Distribution

All entities: UUID primary key (`@PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })`),
decorators from `@mikro-orm/decorators/legacy`. Money is stored as integer cents with an
implicit `EUR` currency, same convention as `ProductPrice` / `OrderLine` / `ReceptionLine`
(lots 1–3). Quantities are `decimal(10,3)` strings, same convention as `OrderLine` /
`StockMovement`. Enums live in contract files and are exposed through `.meta()`, never on the
entity. `createdAt` / `updatedAt` audit fields on every entity, **except** `Handover`,
`HandoverLine`, and `WalletEntry`, which carry `createdAt` only — the same deviation lot 2
recorded for `OrderLine` and lot 3 for `Reception` / `ReceptionLine`, for the same reason
(research.md §7).

Modules: **distribution** (new), **wallet** (new), **orders** / **inventory** / **members** /
**auth** (existing, extended).

---

## wallet module (new)

### WalletEntry

The append-only ledger a member's balance is derived from. **Never edited, never deleted**
(Principle II, FR-022). One row per movement of member money.

| Field | Type | Notes / validation |
| --- | --- | --- |
| `id` | uuid | PK |
| `member` | ManyToOne → `members.Member`, not null, indexed | The balance query groups on this. |
| `amountCents` | integer, signed | **Negative** charges the member, **positive** credits them (research.md §3). Never zero. |
| `currency` | string | `'EUR'`, same as everywhere else. |
| `reason` | enum (contract) `walletEntryReasonSchema`: `handover_charge` \| `payment_received` \| `handover_reversal` | `handover_charge` is negative; the other two are positive. |
| `paymentMethod` | enum (contract) `paymentMethodSchema`: `cash` \| `cheque` \| `transfer`, nullable | Set only on `payment_received` (FR-026). Null on the two handover reasons. |
| `handover` | ManyToOne → `distribution.Handover`, nullable, indexed | Set on `handover_charge` and `handover_reversal`, so 100% of charges trace to a handover (SC-002). Null on `payment_received`. |
| `recordedByUser` | ManyToOne → `auth.User`, nullable | The staff member who validated the handover or entered the payment. Null only if a future system process writes an entry. |
| `note` | string, nullable | Free text: the reason given for a reversal (FR-029), or a cheque number. |
| `createdAt` | Date | **No `updatedAt`** — write-once. |

**Derived, never stored**: `balanceCents = SUM(amountCents) WHERE member = :id`, summed by the
database (research.md §3). A member with no rows has a balance of `0`, not an error (FR-025).

**Invariants**
- No row is ever updated or removed. A correction is a new row (FR-022).
- `SUM(amountCents)` for a member is never negative (FR-027, SC-010) — enforced by the
  balance check inside the member row lock, not by a database constraint (research.md §4).
- Exactly one `handover_charge` per handover, and at most one `handover_reversal` per
  handover (SC-003).

---

## distribution module (new)

### Handover

A record of goods physically given to a member at a point in time. **Write-once** — a mistake
is corrected by a reversing handover, never by an edit (FR-010, research.md §7/§9).

| Field | Type | Notes / validation |
| --- | --- | --- |
| `id` | uuid | PK |
| `order` | ManyToOne → `orders.Order`, not null, indexed | Every handover hangs off a real order, express sales included (research.md §8). |
| `member` | ManyToOne → `members.Member`, not null, indexed | Denormalised from `order.member` so the member's handover history is one query. Always equal to it. |
| `totalAmountCents` | integer | Sum of its lines' `lineTotalAmountCents`. Negative on a reversal. Equals the linked `WalletEntry`'s amount, sign-flipped. |
| `currency` | string | `'EUR'`. |
| `kind` | enum (contract) `handoverKindSchema`: `handover` \| `reversal` | Distinguishes the original from the row that undoes it. |
| `reversesHandover` | ManyToOne → `Handover` (self), nullable, indexed | Set only when `kind = 'reversal'`. **Forward link only** — the original row is never touched (research.md §9). "Is this handover reversed?" is `EXISTS(WHERE reversesHandover = :id)`. |
| `recordedByUser` | ManyToOne → `auth.User`, not null | Who was at the table (FR-029). |
| `note` | string, nullable | The reason given for a reversal. |
| `createdAt` | Date | **No `updatedAt`** — write-once. |

Relationships: `lines` OneToMany → `HandoverLine`.

### HandoverLine

One product on a handover, with the quantity actually given. **Write-once.**

| Field | Type | Notes / validation |
| --- | --- | --- |
| `id` | uuid | PK |
| `handover` | ManyToOne → `Handover`, not null, indexed | |
| `orderLine` | ManyToOne → `orders.OrderLine`, not null, indexed | Always present (research.md §8). Carries the ordered quantity and the snapshot price this line is charged at. |
| `handedQuantity` | decimal(10,3) as string | What was actually given. May be `0` (member declined the line, FR-006), may exceed the ordered quantity (FR-012), and is **negative** on a reversal line. |
| `unitPriceAmountCents` | integer | Copied from `orderLine.unitPriceAmountCents` — the price recorded when the order was placed, never today's price (FR-007). |
| `lineTotalAmountCents` | integer | `round(handedQuantity × unitPriceAmountCents)`. |
| `createdAt` | Date | **No `updatedAt`** — write-once. |

**Derived, never stored**: the difference between ordered and handed over is
`handedQuantity − orderLine.quantity`, computed at read time so FR-012 can show it without a
column that could drift.

**Invariants**
- At most one line per `orderLine` per handover.
- A line with `handedQuantity = 0` writes no `StockMovement` and contributes `0` to the total,
  but it still settles the order line (see "Order settlement" below).

---

## orders module (extended)

### Order (existing — one new status value)

`ORDER_STATUSES` gains `'handed_over'`: `pending | cancelled | handed_over`. The column is a
plain varchar, so no DDL is needed for the new value.

| Transition | When |
| --- | --- |
| `pending → handed_over` | Set inside the handover transaction once **every** line of the order is settled (FR-013), the same way lot 3 flips `SupplierOrder.status` to `received`. |
| `handed_over → pending` | Set by a reversal (FR-030), so the order can be handed over again. |

`Order` keeps `version` and `updatedAt`: it is a mutable entity, so moving its status is a
normal edit, not a ledger write (research.md §9). The order-handover route sends the `version`
it loaded and a stale one is refused (FR-011, research.md §11).

**Order settlement** — an order line is settled when it has a `HandoverLine` on a handover that
has not been reversed:

```sql
EXISTS (
  SELECT 1 FROM "handoverLine" hl
    JOIN "handover" h ON h.id = hl."handoverId"
   WHERE hl."orderLineId" = ol.id
     AND h.kind = 'handover'
     AND NOT EXISTS (SELECT 1 FROM "handover" r WHERE r."reversesHandoverId" = h.id)
)
```

No new column on `OrderLine`. A `handedOverAt` marker following lot 3's `fulfilledAt`
precedent was rejected: a reversal would have to null it, and that precedent is explicitly
*set-once, never reset*.

### OrderLine (existing — unchanged)

No new fields. The checkout snapshot (product, quantity, unit price) stays exactly as lot 2
wrote it, and lot 3's `supplierOrderLine` / `fulfilledAt` markers are read, not written, by
this lot. `fulfilledAt != null` is what makes a pre-order line ready to hand over
(research.md §10).

---

## inventory module (extended)

### StockMovement (existing — add a field, widen an enum)

| Field | Type | Notes |
| --- | --- | --- |
| `handoverLine` | ManyToOne → `distribution.HandoverLine`, nullable, indexed | **New.** Traces an outbound movement back to the handover that caused it (SC-004), mirroring the existing `receptionLine` link. Exactly one of `receptionLine` / `handoverLine` is set. |

`STOCK_MOVEMENT_REASONS` gains two values: `reception | distribution | distribution_reversal`.
Plain varchar column, no DDL.

| Reason | Sign of `quantity` | `unitCostAmountCents` |
| --- | --- | --- |
| `reception` | positive | what the supplier charged |
| `distribution` | **negative** | the product's weighted average cost read inside the same transaction, before this row is appended; `0` if the product has no reception history (research.md §5) |
| `distribution_reversal` | positive | copied from the original outbound row, so the average returns exactly where it was (research.md §9) |

`buildStockLevel` / `inventory.util.ts` are **unchanged** — the arithmetic in research.md §5
shows why issuing at the current average leaves the derived average untouched.

The contract changes: `stockSummarySchema.quantityOnHand` relaxes from
`z.number().nonnegative()` to `z.number()` (research.md §6).

---

## members / auth modules (extended)

`USER_ROLES` gains `'distributor'` in both declarations — `auth/auth.config.ts` and
`members/contracts/member.contract.ts`. `ADMIN_USER_ROLES` stays `['admin']`.
`parseRoles` / `serializeRoles` (`members.util.ts`) and the frontend's
`features/common/lib/roles.ts` must all accept the third value or a distributor reads back as a
plain member (research.md §2). No schema change: roles live in Better Auth's existing
comma-separated `user.role` string.

---

## Cross-entity rules

**One transaction per handover** (Principle II, FR-009). Validating a handover — order-based
or express — does all of this or none of it:

1. lock the `Member` row (`LockMode.PESSIMISTIC_WRITE`) — research.md §4;
2. (express only) create the `Order` and its `OrderLine`s at current prices;
3. load the order's lines and refuse unless `status = 'pending'` and the caller's `version`
   matches;
4. refuse a pre-order line whose `fulfilledAt` is null (FR-003);
5. compute the total from the adjusted quantities at the order's snapshot prices;
6. read the balance and each touched product's current weighted average cost — **before** any
   row is written;
7. refuse with the shortfall if `total > balance` (FR-027);
8. create the `Handover` and its `HandoverLine`s;
9. append one negative `StockMovement` per line with `handedQuantity > 0`;
10. append one negative `WalletEntry` (`handover_charge`);
11. set `order.status = 'handed_over'` if every line is now settled;
12. flush.

**One transaction per reversal**, mirroring it: create the reversing `Handover` with negative
lines, append positive `StockMovement`s at the original unit costs, append one positive
`WalletEntry` (`handover_reversal`) for exactly the original charge, set the order back to
`pending`.

**Recording money received** is a single positive `WalletEntry`; no lock is needed because a
credit can never take the balance below zero.

---

## Migration

One migration (`pnpm --filter=api db:migrate:create`, then review the SQL before applying —
MikroORM can emit DROP+ADD where a RENAME was meant):

- create `walletEntry`, `handover`, `handoverLine`;
- add `stockMovement.handoverLineId` (nullable FK + index);
- indexes: `walletEntry.memberId`, `walletEntry.handoverId`, `handover.orderId`,
  `handover.memberId`, `handover.reversesHandoverId`, `handoverLine.handoverId`,
  `handoverLine.orderLineId`.

No DDL for the new `order.status`, `stockMovement.reason`, or role values — all three are
varchar columns whose allowed values live in the contract enums.
