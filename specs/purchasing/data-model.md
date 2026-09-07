# Phase 1 Data Model: Purchasing

All entities: UUID primary key (`@PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })`),
decorators from `@mikro-orm/decorators/legacy`. Money is stored as integer cents with an
implicit `EUR` currency, same convention as `ProductPrice` / `OrderLine` (lots 1–2). Enums
live in contract files and are exposed through `.meta()`, never on the entity. `createdAt` /
`updatedAt` audit fields on every entity, **except** `Reception` and `ReceptionLine`, which
carry `createdAt` only — the same deviation lot 2 recorded for `OrderLine`, for the same
reason (research.md §7).

Modules: **purchasing** (new), **inventory** (new), **orders** (existing, extended).

---

## orders module (extended)

### OrderLine (existing — add fields)

| Field | Type | Notes |
| --- | --- | --- |
| `supplierOrderLine` | ManyToOne → `purchasing.SupplierOrderLine`, nullable | Set once, at aggregation time (research.md §3). `null` means "still pending, not yet aggregated for any supplier" — exactly the set FR-005/aggregation queries against. |
| `fulfilledAt` | Date, nullable | Set once, the first time a reception is confirmed for this line's product on its linked supplier order (research.md §6). Never reset. |

No other change to `OrderLine` or `Order`. `Order.status` keeps its lot 2 values
(`pending` / `cancelled`) — lot 3 does not add a new order-level status (research.md §6).

---

## purchasing module (new)

### SupplierOrder

Created by aggregation, one per supplier per aggregation run.

| Field | Type | Notes / validation |
| --- | --- | --- |
| `id` | uuid | PK |
| `supplier` | ManyToOne → `catalog.Supplier`, not null | |
| `status` | enum (contract) `supplierOrderStatusSchema`: `draft` \| `sent` \| `received` \| `closed` | Starts `draft` (FR-001). `received` is set automatically once every line's cumulative received quantity is at least its ordered quantity; `closed` is set explicitly by staff (FR-021) and is otherwise identical to `received` except it can carry lines never fully honored (FR-023). Both are terminal. |
| `sentAt` | Date, nullable | Set once, by the "send" action (FR-007). |
| `closedAt` | Date, nullable | Set once, by the "close" action, or automatically alongside `status = 'received'`. |
| `version` | integer | optimistic lock (send / receive / close all transition `status`) |
| `createdAt` / `updatedAt` | Date | audit |

Relationships: `lines` OneToMany → `SupplierOrderLine`; `receptions` OneToMany →
`Reception`.

**State machine** (`status`):

```
              aggregation
                   │
                   ▼
                draft ─── send (FR-007) ──▶ sent ──┬── every line fully received ──▶ received
                                                     │        (automatic)
                                                     └── staff closes (FR-021) ──▶ closed
```

- `draft → sent`: only from `draft` (FR-008 refuses a repeat).
- `sent → received`: automatic, checked after each reception is confirmed, when every
  line's received total is `>=` its ordered quantity.
- `sent → closed`: only from `sent`, staff-triggered, regardless of how much was received
  (FR-021). Recording a reception is refused once `status` is `received` or `closed`
  (FR-015/FR-022).

### SupplierOrderLine

One product's aggregated demand on a supplier order.

| Field | Type | Notes / validation |
| --- | --- | --- |
| `id` | uuid | PK |
| `supplierOrder` | ManyToOne → `SupplierOrder`, not null | |
| `product` | ManyToOne → `catalog.Product`, not null | |
| `quantity` | decimal(10,3) | The summed ordered amount — piece count (positive integer) or kilograms (positive, ≤ 3 decimals), per `product.saleMode`, same convention as `CartLine.quantity` / `OrderLine.quantity`. |
| `createdAt` / `updatedAt` | Date | audit |

Relationships: `sourceOrderLines` OneToMany ← `orders.OrderLine.supplierOrderLine` (FR-002
traceability); `receptionLines` OneToMany → `ReceptionLine`.

Unique constraint: (`supplierOrder`, `product`) — aggregation groups by product, so a
supplier order never has two lines for the same product.

**Received-so-far** and **discrepancy** (not stored): `SUM(receptionLines.receivedQuantity)`
compared to `quantity`, computed at read time (research.md §5) — a line whose sale mode is
`unit` flags on any non-zero difference; a line whose product is `weight` flags only when
the difference exceeds `product.weightTolerancePercent` of the ordered quantity.

### Reception

One delivery event against a sent supplier order. A supplier order can have several
(FR-013).

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | PK |
| `supplierOrder` | ManyToOne → `SupplierOrder`, not null | Refused (service-level `ConflictException`, `409`) unless `supplierOrder.status = 'sent'` (FR-015). |
| `receivedAt` | Date | Set once, at creation — when the reception was confirmed. |
| `createdAt` | Date | audit (no `updatedAt` — immutable, per lot 2's `OrderLine` precedent, research.md §7) |

Relationships: `lines` OneToMany → `ReceptionLine`.

### ReceptionLine

One product's actual delivery detail within a reception.

| Field | Type | Notes / validation |
| --- | --- | --- |
| `id` | uuid | PK |
| `reception` | ManyToOne → `Reception`, not null | |
| `supplierOrderLine` | ManyToOne → `SupplierOrderLine`, not null | Which ordered line this reception line answers. |
| `receivedQuantity` | decimal(10,3) | `>= 0` (a zero-received line is valid — "did not arrive at all", edge case in spec). Same unit convention as `SupplierOrderLine.quantity`. |
| `unitCostAmountCents` | integer | `>= 0`. The unit cost actually paid for this delivery (FR-010) — feeds the weighted average cost price (research.md §4). |
| `currency` | string | `'EUR'` |
| `createdAt` | Date | audit (no `updatedAt` — immutable, same as `Reception`) |

---

## inventory module (new)

### StockMovement

The only source of truth for a product's stock level and cost price (Principle II;
research.md §4). In lot 3 every movement is an inbound reception, so `quantity` is always
positive and `unitCostAmountCents` always present; the shape leaves room for a future
signed, sometimes-costless movement type (a lot 4 distribution debit) without a schema
change, but lot 3 does not build that type.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | PK |
| `product` | ManyToOne → `catalog.Product`, not null | |
| `quantity` | decimal(10,3) | Positive in lot 3 (an inbound movement). Same unit convention as elsewhere. |
| `unitCostAmountCents` | integer | The unit cost this movement carries — required in lot 3 since every movement originates from a reception. |
| `currency` | string | `'EUR'` |
| `reason` | enum (contract) `stockMovementReasonSchema`: `reception` in lot 3, open for a later lot/increment to add `distribution` / `adjustment` / `count_correction` | |
| `receptionLine` | ManyToOne → `purchasing.ReceptionLine`, nullable | Traces the movement back to its source (SC-003). Nullable so a future non-reception movement type is not forced to fabricate one. |
| `createdAt` | Date | audit (no `updatedAt` — append-only ledger row, Principle II) |

**Derived reads** (not stored, `InventoryService`, research.md §4), per product:

- **Stock level** = `SUM(quantity)` over its movements (`0` if none).
- **Weighted average cost price** = `SUM(quantity * unitCostAmountCents) / SUM(quantity)`
  over its movements (`null` — "no cost price yet" — if none, per FR-020).

---

## Cross-entity rules

- **A `SupplierOrderLine` is created once, by aggregation, and its `quantity` never
  changes afterward.** Correcting an over- or under-aggregation is out of scope for lot 3
  (not in the spec); staff work around it via the reception's own discrepancy handling.
- **Confirming a reception is one transaction**: read the supplier order and its lines →
  validate status is `sent` → create the `Reception` + its `ReceptionLine`s → create one
  `StockMovement` per `ReceptionLine` → mark newly-covered `OrderLine`s `fulfilledAt` →
  recompute whether every `SupplierOrderLine` is now fully received and flip
  `SupplierOrder.status` to `received` if so. MikroORM's default per-request transaction
  covers this since it all happens inside one controller call, same pattern as lot 2's
  `checkout`.
- **Nothing here edits a `WalletEntry`** — wallet debits are lot 4's job; this lot only
  writes `StockMovement` rows, and only ever with a positive quantity.
- **Aggregation, sending, receiving, and closing are all admin-only actions** in lot 3
  (spec Assumptions — the `grocer` role does not exist until lot 4).
