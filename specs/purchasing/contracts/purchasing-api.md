# Contract: Supplier Orders and Receptions (new `purchasing` module)

REST, `@AdminOnly()` on every route (spec Assumptions — the `grocer` role does not exist
until lot 4). Schemas are Zod outlines; the real `contracts/*.contract.ts` files carry
`.meta()` and export inferred types.

---

## Enums

```ts
supplierOrderStatusSchema = z.enum(['draft', 'sent', 'received', 'closed']).meta({
  title: 'SupplierOrderStatus',
  description:
    'draft: just aggregated, lines can still change on the next aggregation run for other ' +
    'products. sent: fixed, awaiting delivery. received: every line fully delivered ' +
    '(automatic). closed: staff ended it early, some lines may be short (FR-023).',
})

discrepancyKindSchema = z.enum(['short', 'over', 'none']).meta({
  title: 'DiscrepancyKind',
  description:
    'Comparison of a supplier-order line\'s received-so-far total against its ordered ' +
    'quantity, computed at read time — never stored (research.md §5).',
})
```

---

## Aggregation

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/admin/suppliers/:supplierId/purchasing/aggregate` | Combine every pending, not-yet-aggregated pre-order line for this supplier's products into one new draft supplier order. |

No request body.

```ts
supplierOrderLineSchema = z.object({
  id: z.string().uuid(),
  product: z.object({
    id: z.string().uuid(),
    name: z.string(),
    saleMode: productSaleModeSchema,
  }),
  quantity: z.number().positive(),
  receivedQuantity: z.number().nonnegative(),   // sum of confirmed reception lines, computed at read time
  discrepancy: discrepancyKindSchema,
  contributingMemberCount: z.number().int().positive(), // how many distinct pre-orders fed this line (FR-002)
  estimatedUnitCostEur: z.number().nonnegative().nullish(), // last known weighted average cost, if the product has ever been received (research.md §8)
}).meta({ title: 'SupplierOrderLine' })

supplierOrderSchema = z.object({
  id: z.string().uuid(),
  supplier: z.object({ id: z.string().uuid(), name: z.string() }),
  status: supplierOrderStatusSchema,
  sentAt: z.date().nullish(),
  closedAt: z.date().nullish(),
  estimatedTotalEur: z.number().nonnegative(),     // sum of lines with a known estimatedUnitCostEur — partial if some are null
  hasUnknownCostLines: z.boolean(),                 // true when at least one line has no cost estimate yet
  version: z.number().int(),
}).meta({ title: 'SupplierOrder' })

supplierOrderDetailSchema = supplierOrderSchema.extend({
  lines: z.array(supplierOrderLineSchema),
  receptions: z.array(receptionSchema),             // see below
}).meta({ title: 'SupplierOrderDetail' })
```

Errors: `404` unknown supplier · `409` nothing pending to aggregate for this supplier
(FR-004).

---

## Supplier orders

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/admin/purchasing/supplier-orders` | Paginated list. Filters: `status`, `supplierId`. |
| GET | `/admin/purchasing/supplier-orders/:id` | Full detail, including lines and reception history. |
| GET | `/admin/purchasing/supplier-orders/:id/export` | A plain-text/CSV summary of a sent order's lines, for communicating it to the supplier (FR-009). |
| POST | `/admin/purchasing/supplier-orders/:id/send` | `draft` → `sent`. |
| POST | `/admin/purchasing/supplier-orders/:id/close` | `sent` → `closed`. |

```ts
supplierOrdersListSchema = paginatedSchema(supplierOrderSchema)
```

### `POST /admin/purchasing/supplier-orders/:id/send`

```ts
sendSupplierOrderSchema = z.object({ version: z.number().int() })
```

Errors: `404` unknown order · `409` not currently `draft` (FR-008), or `version` stale.

### `POST /admin/purchasing/supplier-orders/:id/close`

```ts
closeSupplierOrderSchema = z.object({ version: z.number().int() })
```

Errors: `404` unknown order · `409` not currently `sent` (already `received` or `closed`),
or `version` stale.

---

## Receptions

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/admin/purchasing/supplier-orders/:id/receptions` | Record what was actually delivered, line by line. Triggers stock movements, cost price recalculation, and pre-order fulfillment marking. |

```ts
recordReceptionSchema = z.object({
  lines: z.array(z.object({
    supplierOrderLineId: z.string().uuid(),
    receivedQuantity: z.number().nonnegative(),
    unitCostEur: z.number().nonnegative(),
  })).min(1),
}).meta({
  title: 'RecordReception',
  description:
    'One entry per supplier-order line being received in this shipment. A line not ' +
    'included here is simply not part of this reception — it can be received later or ' +
    'included in the initial "not delivered" state if never received (edge case: record ' +
    'it explicitly with receivedQuantity: 0 to flag it fully short).',
})

receptionLineSchema = z.object({
  id: z.string().uuid(),
  supplierOrderLineId: z.string().uuid(),
  productName: z.string(),
  orderedQuantity: z.number().positive(),
  receivedQuantity: z.number().nonnegative(),
  discrepancy: discrepancyKindSchema,
  unitCostEur: z.number().nonnegative(),
}).meta({ title: 'ReceptionLine' })

receptionSchema = z.object({
  id: z.string().uuid(),
  receivedAt: z.date(),
  lines: z.array(receptionLineSchema),
}).meta({ title: 'Reception' })
```

Errors: `404` unknown order, or a `supplierOrderLineId` not on this order · `409`
`supplierOrder.status` is not `sent` (FR-015/FR-022 — refuses on `draft` or `closed`) ·
`422` a negative `receivedQuantity` or `unitCostEur`.

Response is the created `receptionSchema`; the caller re-fetches
`GET /admin/purchasing/supplier-orders/:id` to see the order's updated `status` and each
line's refreshed `receivedQuantity` / `discrepancy` (SC-005 — immediate, but read via a
follow-up `GET` rather than duplicated in the write response).

---

## Errors (shared)

| Status | When |
| --- | --- |
| `401` | No session. |
| `403` | Signed in but not an admin. |
| `404` | Resource doesn't exist. |
| `409` | Invalid state transition, optimistic-lock conflict, or nothing to aggregate. |
| `422` | A quantity or cost fails validation. |
