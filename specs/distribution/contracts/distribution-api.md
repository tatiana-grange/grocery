# Contract: Distribution Screen, Handover, Express Order (new `distribution` module)

REST, `@StaffOnly()` (= `@Roles('distributor', 'admin')`) on every route — research.md §2.
Schemas are Zod outlines; the real `contracts/*.contract.ts` files carry `.meta()` on every
request and response schema and export the inferred type next to it (Principle I).

Money crosses the wire in euros (`…Eur`) and is stored in cents, same convention as lots 1–3.
Quantities cross as numbers with 3-decimal precision.

---

## Finding a member and reading their screen

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/distribution/members` | Search members by name or membership number (FR-001). Paginated. Filters: `search`. |
| GET | `/distribution/members/:memberId` | Everything the table needs for one member: status, balance, and every outstanding order with its lines (FR-002, FR-004, FR-005). |

```ts
distributionMemberSummarySchema = z.object({
  id: z.string().uuid(),
  membershipNumber: z.string(),
  name: z.string(),
  status: memberStatusSchema,            // reused from members.contract
  balanceEur: z.number(),                // never negative (SC-010)
  outstandingOrderCount: z.number().int().nonnegative(),
}).meta({ title: 'DistributionMemberSummary' })

distributionLineSchema = z.object({
  orderLineId: z.string().uuid(),
  productId: z.string().uuid(),
  productName: z.string(),               // the checkout snapshot, not today's name
  saleMode: productSaleModeSchema,       // 'unit' | 'weight' — drives the scale input
  orderedQuantity: z.number(),
  availableQuantity: z.number(),         // the product's current stock on hand (research.md §10)
  unitPriceEur: z.number().nonnegative(),// the price recorded at checkout (FR-007)
  lineTotalEur: z.number().nonnegative(),
  isReady: z.boolean(),                  // pre-order: fulfilledAt != null. in-store: always true
  notReadyReason: notReadyReasonCodeSchema.nullish(),
}).meta({ title: 'DistributionLine' })

notReadyReasonCodeSchema = z.enum(['awaiting_reception']).meta({
  title: 'NotReadyReasonCode',
  description: 'Why a line cannot be handed over yet — the frontend maps this to a translated message.',
})

distributionOrderSchema = z.object({
  id: z.string().uuid(),
  orderingMode: orderingModeChoiceSchema, // 'pre_order' | 'in_store', reused from order.contract
  placedAt: z.date(),
  totalEur: z.number().nonnegative(),
  isReady: z.boolean(),                   // every line ready (FR-003)
  version: z.number().int(),              // sent back on validate (FR-011)
  lines: z.array(distributionLineSchema),
}).meta({ title: 'DistributionOrder' })

distributionMemberScreenSchema = distributionMemberSummarySchema.extend({
  orders: z.array(distributionOrderSchema),
}).meta({
  title: 'DistributionMemberScreen',
  description: 'One member’s outstanding orders, balance and status — the whole table screen in one call',
})
```

A member with nothing outstanding returns `orders: []`, not a 404 (US1 scenario 5).

---

## Handing over an order

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/distribution/orders/:orderId/handovers` | Validate a handover: record it, move stock, charge the member (FR-008, FR-009). |

```ts
recordHandoverSchema = z.object({
  version: z.number().int(),             // the Order.version the screen loaded (FR-011)
  lines: z.array(z.object({
    orderLineId: z.string().uuid(),
    handedQuantity: z.number().nonnegative(),  // 0 = declined (FR-006); may exceed ordered (FR-012)
  })).min(1),
  note: z.string().max(500).optional(),
}).meta({
  title: 'RecordHandoverInput',
  description: 'What was actually handed over. Lines left out stay outstanding for a later distribution.',
})

handoverLineSchema = z.object({
  id: z.string().uuid(),
  productName: z.string(),
  orderedQuantity: z.number(),
  handedQuantity: z.number(),
  differenceQuantity: z.number(),        // handed − ordered, computed at read time (FR-012)
  unitPriceEur: z.number().nonnegative(),
  lineTotalEur: z.number(),
}).meta({ title: 'HandoverLine' })

handoverSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  memberId: z.string().uuid(),
  kind: handoverKindSchema,
  totalEur: z.number(),
  reversesHandoverId: z.string().uuid().nullish(),
  isReversed: z.boolean(),               // EXISTS(reversesHandover = id) — read-time (research.md §9)
  recordedBy: z.string(),                // staff name
  note: z.string().nullish(),
  createdAt: z.date(),
  lines: z.array(handoverLineSchema),
  balanceAfterEur: z.number(),           // so the screen can show the receipt without a second call
}).meta({ title: 'Handover' })

handoverKindSchema = z.enum(['handover', 'reversal']).meta({ title: 'HandoverKind' })
```

**Refusals** — all `409 Conflict` with an explicit `statusCode` in the body, so the generated
client's `isConflict` helper keys off it (the lot 3 `ConflictException` note):

| Condition | Body |
| --- | --- |
| Total exceeds the balance (FR-027) | `{ statusCode: 409, message, code: 'insufficient_balance', shortfallEur, balanceEur, totalEur }` |
| Order is not `pending` — already handed over (FR-011) | `{ statusCode: 409, code: 'order_not_pending' }` |
| Stale `version` — someone else validated it (FR-011) | `{ statusCode: 409, code: 'stale_version' }` |
| A line is not ready (FR-003) | `{ statusCode: 409, code: 'line_not_ready', productName }` |
| Member is terminated (FR-005) | `{ statusCode: 409, code: 'member_terminated' }` |
| Every line is zero | `{ statusCode: 409, code: 'nothing_handed_over' }` |

`404` for an order id that does not exist or an `orderLineId` that is not on that order.

---

## Express order

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/distribution/products` | Products a staffer can sell at the table: not archived, orderable in store, searchable by name **or barcode** (FR-014). Returns the current price and current stock so the screen can warn (FR-018). Paginated. Filters: `search`, `categoryId`. |
| POST | `/distribution/members/:memberId/express-orders` | Create the order and hand it over in one step (FR-017). |

```ts
distributionProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  barcode: z.string().nullish(),
  saleMode: productSaleModeSchema,
  selectionUnit: productSelectionUnitSchema.nullish(),
  quantityStepGrams: z.number().int().nullish(),
  unitPriceEur: z.number().nonnegative(),   // current price (FR-015)
  quantityOnHand: z.number(),               // may be negative — research.md §6
}).meta({ title: 'DistributionProduct' })

createExpressOrderSchema = z.object({
  lines: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().positive(),
  })).min(1),
  note: z.string().max(500).optional(),
}).meta({
  title: 'CreateExpressOrderInput',
  description: 'Built at the table and sent once. Nothing is persisted before this call (FR-016).',
})
```

Returns the same `handoverSchema`. Refusals reuse the table above, plus `409`
`{ code: 'product_not_sellable' }` for an archived or non-in-store product (FR-014) and
`400` for an empty or all-zero line list (FR-019). Exceeding stock is **not** a refusal — the
screen warns from `quantityOnHand` before the call (FR-018).

---

## Reversal

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/distribution/handovers/:handoverId/reversal` | Undo a validated handover (FR-028–FR-030). |
| GET | `/distribution/handovers/:handoverId` | One handover, for the on-screen receipt and the reversal confirmation. |

```ts
reverseHandoverSchema = z.object({
  note: z.string().min(1).max(500),     // the reason, kept with the reversal (FR-029)
}).meta({ title: 'ReverseHandoverInput' })
```

Returns the reversing `handoverSchema` (negative totals). `409`
`{ code: 'already_reversed' }` when one already exists, and
`{ code: 'cannot_reverse_reversal' }` for a handover whose `kind` is already `reversal`.

---

## Waiting lists

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/distribution/waiting` | Orders still to hand over (FR-031–FR-033). Paginated. Filters: `orderingMode` (`pre_order` \| `in_store`), `readyOnly`, `placedFrom`, `placedTo`. |

```ts
waitingOrderSchema = z.object({
  orderId: z.string().uuid(),
  member: z.object({
    id: z.string().uuid(),
    membershipNumber: z.string(),
    name: z.string(),
  }),
  orderingMode: orderingModeChoiceSchema,
  placedAt: z.date(),
  totalEur: z.number().nonnegative(),
  lineCount: z.number().int().positive(),
  isReady: z.boolean(),
}).meta({ title: 'WaitingOrder' })

waitingOrderListSchema = paginatedSchema(waitingOrderSchema)
```

A fully handed-over order leaves the list because its status is no longer `pending`
(FR-032).
