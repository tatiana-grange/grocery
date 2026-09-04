# Contract: Cart and Orders (new `orders` module)

REST, `@MemberScoped()` on every route (session + confirmed identifier + active
membership, admins included since admin is a member "plus" — see lot 1's
`auth-roles-api.md`). Every route implicitly scopes to the caller's own cart/orders; there
is no `:memberId` in any path. Schemas are Zod outlines; the real
`contracts/*.contract.ts` files carry `.meta()` and export inferred types.

---

## Enums

```ts
orderingModeChoiceSchema = z.enum(['pre_order', 'in_store']).meta({
  title: 'OrderingModeChoice',
  description:
    'One concrete ordering type — never "both". Types a cart line and an order. ' +
    'A product that supports "both" is resolved to one of these when the member adds it to the cart.',
})

orderStatusSchema = z.enum(['pending', 'cancelled']).meta({
  title: 'OrderStatus',
  description: 'pending is the only starting value in lot 2; later lots add processing/fulfilment values to this same field',
})
```

---

## Cart

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/cart` | The caller's cart (created empty on first read if it doesn't exist yet). |
| POST | `/cart/lines` | Add a product, or increase quantity if the same product + ordering mode is already a line. |
| PUT | `/cart/lines/:lineId` | Change a line's quantity. |
| DELETE | `/cart/lines/:lineId` | Remove a line. |
| POST | `/cart/checkout` | Turn the cart into one order per ordering type present; empty the cart. |

```ts
cartLineSchema = z.object({
  id: z.string().uuid(),
  product: z.object({
    id: z.string().uuid(),
    name: z.string(),
    saleMode: productSaleModeSchema,
    photos: z.array(z.string()),
  }),
  orderingMode: orderingModeChoiceSchema,
  quantity: z.number().positive(),
  unitPriceEur: z.number().positive(),      // current price, read at response time
  lineTotalEur: z.number().positive(),      // quantity * unitPriceEur
  isValid: z.boolean(),                     // false once the product is archived or no longer offers this ordering mode
  invalidReason: z.string().nullish(),      // set when isValid is false (FR-012)
}).meta({ title: 'CartLine' })

cartSchema = z.object({
  id: z.string().uuid(),
  lines: z.array(cartLineSchema),
  totalEur: z.number().nonnegative(),       // sum of valid lines' lineTotalEur
  version: z.number().int(),
}).meta({ title: 'Cart' })
```

### `POST /cart/lines`

```ts
addCartLineSchema = z.object({
  productId: z.string().uuid(),
  orderingMode: orderingModeChoiceSchema,
  quantity: z.number().positive(),
}).meta({
  title: 'AddCartLine',
  description:
    'quantity is a piece count (integer) for a unit-sale product, or kilograms (up to 3 decimals) for a by-weight product',
})
```

Errors: `404` unknown/archived product · `409` `orderingMode` not offered by the product
(`in_store` requested on a `pre_order`-only product, etc.) · `422` quantity fails the
sale-mode rule (non-integer for `unit`, ≤0, or >3 decimals for `weight`).

### `PUT /cart/lines/:lineId`

```ts
updateCartLineSchema = z.object({ quantity: z.number().positive() })
```

`404` if the line doesn't belong to the caller's cart. Same `422` quantity rule as above.

### `POST /cart/checkout`

No request body.

```ts
checkoutResultSchema = z.object({
  orders: z.array(orderDetailSchema),       // see below — one per ordering type present, with its lines
  droppedLines: z.array(z.object({
    productName: z.string(),
    reason: z.string(),
  })),
}).meta({ title: 'CheckoutResult' })
```

`orders` carries each order's `lines`, not just its summary — the checkout confirmation
must show them (spec.md US3 Acceptance Scenario 3: "they see its lines, quantities,
total...").

Errors: `409` empty cart (nothing left to check out after dropping invalid lines) — FR-013.

---

## Orders

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/orders` | Paginated list of the caller's own orders. Filters: `status`, `orderingMode`. |
| GET | `/orders/:id` | Full detail of one of the caller's own orders. |
| POST | `/orders/:id/cancel` | Cancel while `pending`. |
| POST | `/orders/:id/repeat` | Merge the order's still-orderable lines into the caller's current cart. |

```ts
orderLineSchema = z.object({
  id: z.string().uuid(),
  productName: z.string(),          // productNameSnapshot
  quantity: z.number().positive(),
  unitPriceEur: z.number().positive(),
  lineTotalEur: z.number().positive(),
}).meta({ title: 'OrderLine' })

orderSchema = z.object({
  id: z.string().uuid(),
  orderingMode: orderingModeChoiceSchema,
  status: orderStatusSchema,
  totalEur: z.number().nonnegative(),
  placedAt: z.date(),
  cancelledAt: z.date().nullish(),
  version: z.number().int(),
}).meta({ title: 'Order' })

orderDetailSchema = orderSchema.extend({
  lines: z.array(orderLineSchema),
}).meta({ title: 'OrderDetail' })

ordersListSchema = paginatedSchema(orderSchema)
```

### `POST /orders/:id/cancel`

```ts
cancelOrderSchema = z.object({ version: z.number().int() })
```

Errors: `404` not the caller's order · `409` already `cancelled`, `version` stale, or the
order has moved past `pending` (message distinguishes "already cancelled" from "already
being processed, contact the grocery" — FR-021).

### `POST /orders/:id/repeat`

No request body.

```ts
repeatOrderResultSchema = z.object({
  cart: cartSchema,
  skippedLines: z.array(z.object({
    productName: z.string(),
    reason: z.string(),
  })),
}).meta({ title: 'RepeatOrderResult' })
```

Merges into the existing cart (research.md §5) — never replaces it. `404` if the order
isn't the caller's.

---

## Errors (shared)

| Status | When |
| --- | --- |
| `401` | No session. |
| `403` | Signed in but not an active member (pending / rejected / terminated) — same rule as every other `@MemberScoped()` route. |
| `404` | Resource doesn't exist, or exists but belongs to someone else. |
| `409` | Optimistic-lock conflict, invalid state transition, or empty-cart checkout. |
| `422` | Quantity fails its sale-mode rule. |
