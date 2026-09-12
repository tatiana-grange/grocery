# Contract: Stock and Cost Price Reads (new `inventory` module)

REST, `@AdminOnly()` on every route. Read-only in lot 3 — every write to stock happens as a
side effect of `POST /admin/purchasing/supplier-orders/:id/receptions` (see
`purchasing-api.md`), not through this module's own endpoints. Schemas are Zod outlines;
the real `contracts/*.contract.ts` files carry `.meta()` and export inferred types.

---

## Stock

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/admin/inventory/stock` | Paginated list of every product with its current stock level and cost price. Filters: `search` (product name), `categoryId`. |
| GET | `/admin/inventory/products/:productId/stock` | One product's current stock level, cost price, and movement history. |

```ts
stockSummarySchema = z.object({
  product: z.object({
    id: z.string().uuid(),
    name: z.string(),
    saleMode: productSaleModeSchema,
  }),
  quantityOnHand: z.number().nonnegative(),
  costPriceEur: z.number().nonnegative().nullish(),  // null when the product has never been received (FR-020)
}).meta({ title: 'StockSummary' })

stockListSchema = paginatedSchema(stockSummarySchema)

stockMovementSchema = z.object({
  id: z.string().uuid(),
  quantity: z.number(),
  unitCostEur: z.number().nonnegative(),
  reason: stockMovementReasonSchema,
  createdAt: z.date(),
}).meta({ title: 'StockMovement' })

stockMovementReasonSchema = z.enum(['reception']).meta({
  title: 'StockMovementReason',
  description:
    'reception is the only value in lot 3; a later inventory increment adds distribution, ' +
    'adjustment, and count_correction to this same field.',
})

stockDetailSchema = stockSummarySchema.extend({
  movements: z.array(stockMovementSchema),   // newest first, each traceable to its reception (SC-003)
}).meta({ title: 'StockDetail' })
```

Errors: `404` unknown product on `/products/:productId/stock`.

A product with no movements returns `quantityOnHand: 0`, `costPriceEur: null`, and an empty
`movements` array — never a `404` for "never received" (FR-020: this is a normal, expected
state, not an error).

---

## Errors (shared)

| Status | When |
| --- | --- |
| `401` | No session. |
| `403` | Signed in but not an admin. |
| `404` | Product doesn't exist at all. |
