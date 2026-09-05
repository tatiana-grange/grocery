# Phase 1 Data Model: Shop and Orders

All entities: UUID primary key (`@PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })`),
`createdAt` and `updatedAt` audit fields, decorators from `@mikro-orm/decorators/legacy`.
Money is stored as integer cents with an implicit `EUR` currency, same convention as
`ProductPrice` (lot 1). Enums live in the contract files and are exposed through
`.meta()`, never on the entity.

Modules: **catalog** (existing, extended), **orders** (new).

---

## catalog module (extended)

### Product (existing — add field)

| Field | Type | Notes |
| --- | --- | --- |
| `orderingMode` | enum (contract): `pre_order` \| `in_store` \| `both` | How the product can be ordered. Admin-set on the existing product form. `NOT NULL`; lot 1 seed data backfilled to `in_store`. |

No other change to `Product`. `photos`, `labels`, `saleMode`, `barcode` (already present)
are exactly what the shop's product card and detail page read.

**Validation**: unchanged fields keep their lot 1 rules. `orderingMode` has no
cross-field rule in lot 2 (a `weight`-sale product can be `pre_order`, `in_store`, or
`both`, same as a `unit`-sale one).

---

## orders module (new)

### Cart

One active cart per member — created on the first `GET /cart` if it does not exist yet
(`getOrCreateCart`), so `POST /cart/lines` always has a cart to append to.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | PK |
| `member` | ManyToOne → Member, unique, not null | `@Unique()` enforces one cart per member |
| `version` | integer | MikroORM entity version, bumped on every line change and surfaced in `cartSchema` so the SPA can detect a cart that changed under it and refetch. Lot 2 does not require the client to send it back. Checkout needs no version guard: it empties the cart in one transaction, so a double-submitted checkout finds nothing left to turn into orders. |
| `createdAt` / `updatedAt` | Date | audit |

Relationships: `lines` OneToMany → CartLine.

A cart is never deleted; once created it is reused (and emptied at checkout) for the
life of the membership.

### CartLine

| Field | Type | Notes / validation |
| --- | --- | --- |
| `id` | uuid | PK |
| `cart` | ManyToOne → Cart, not null | |
| `product` | ManyToOne → Product, not null | |
| `orderingMode` | enum (contract) `orderingModeChoiceSchema`: `pre_order` \| `in_store` | The type chosen for *this line* — always one of the two concrete values, never `both`, even when the product supports `both` (FR-009). |
| `quantity` | decimal(10,3) | Piece count when `product.saleMode = 'unit'` (must be a positive integer); kilograms when `product.saleMode = 'weight'` (positive, ≤ 3 decimal places). |
| `createdAt` / `updatedAt` | Date | audit |

Unique constraint: (`cart`, `product`, `orderingMode`) — adding a product already in the
cart under the same ordering mode increases `quantity` instead of creating a second line
(FR-008/FR-010). Adding the same product under the *other* ordering mode (when the
product supports `both`) creates a second, independent line (edge case in spec).

**Line total** (not stored): `quantity × product's current open ProductPrice.amountCents`,
computed by the mapper at read time — the cart is not yet money, only intent (research.md
§4). A line whose product has become unorderable (archived, or no longer offering its
`orderingMode`) is still returned by `GET /cart` but flagged `isValid: false` with a
reason, per FR-012; it is dropped, not silently kept, at checkout time.

### Order

Created at checkout, one per ordering type present in the cart at that moment.

| Field | Type | Notes / validation |
| --- | --- | --- |
| `id` | uuid | PK |
| `member` | ManyToOne → Member, not null | |
| `orderingMode` | enum (contract) `orderingModeChoiceSchema`: `pre_order` \| `in_store` | Fixed for the life of the order — every line on it shares this value. |
| `status` | enum (contract): `pending` \| `cancelled` in lot 2; open for lot 3/4 to add values (research.md §6) | Starts `pending` (FR-017). |
| `totalAmountCents` | integer | Sum of its lines' `lineTotalAmountCents`, stored (not recomputed) because it must survive later catalogue price changes (FR-011/SC-006). |
| `currency` | string | `'EUR'` |
| `placedAt` | Date | Set once, at creation. |
| `cancelledAt` | Date \| null | Set on cancel. |
| `version` | integer | optimistic lock (for the cancel action) |
| `createdAt` / `updatedAt` | Date | audit |

Relationships: `lines` OneToMany → OrderLine.

**State machine** (`status`):

```
                 checkout
                     │
                     ▼
                 pending ─── member cancels (FR-021) ──▶ cancelled
                     │
        lot 3 aggregates / lot 4 distributes
        (values added by later lots, not lot 2)
                     ▼
              <future statuses>
```

- `pending → cancelled`: allowed only from `pending`; the controller returns `409` with an
  explanation if the order has already moved on (guarded by the same `status` field later
  lots will extend — lot 2 only ever sets it away from `pending` via cancel).
- No other transition exists in lot 2.

### OrderLine

An immutable snapshot, written once at checkout and never edited afterward.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | PK |
| `order` | ManyToOne → Order, not null | |
| `product` | ManyToOne → Product, not null | kept even if the product is later archived (archiving never deletes the row) |
| `productNameSnapshot` | string | copied at checkout so the line still reads sensibly even if the product's name later changes |
| `quantity` | decimal(10,3) | same meaning as `CartLine.quantity`, copied at checkout |
| `unitPriceAmountCents` | integer | the product's price at the moment of checkout |
| `lineTotalAmountCents` | integer | `quantity × unitPriceAmountCents`, integer-rounded the same way `ProductPrice` amounts are |
| `createdAt` | Date | audit (no `updatedAt` — the row never changes; this deviation from the "audit fields on every entity" data rule is recorded in plan.md Complexity Tracking) |

---

## Cross-entity rules

- **One cart per member, many orders per member.** A cart is reused for the life of the
  membership; checkout never deletes it, only clears its lines.
- **Checkout is one transaction**: read cart → validate lines → create N orders + their
  lines → clear cart lines. MikroORM's default per-request transaction covers this since
  it all happens inside one controller call.
- **Nothing here writes a `WalletEntry` or `StockMovement` row** — Principle II does not
  apply to this lot's writes; money and stock ledgers stay untouched until lot 4/3
  respectively.
- **Every list a member can reach is scoped to `member = current member`** — `GET /cart`,
  `GET /orders`, `GET /orders/:id`, cancel, and repeat all filter or check ownership by the
  authenticated member, enforced in `OrdersService`, not just in the controller guard.
