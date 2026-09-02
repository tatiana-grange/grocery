# Contract: Catalogue

REST, `admin/*` prefix, `@AdminOnly()` on every route (lot 1 has no public shop — that is
lot 2). Follows the `posts` controller conventions. Schemas are Zod outlines; the real
`contracts/*.contract.ts` files carry `.meta()` and export inferred types.

Money is exchanged as **decimal euros** at the API edge (`z.number()` with 2-decimal
meaning) and stored as integer cents — a contract-level transform, kept in one helper.

---

## Enums

```ts
supplierTypeSchema     = z.enum(['producer', 'wholesaler'])
productSaleModeSchema  = z.enum(['unit', 'weight'])
productPricingUnitSchema = z.enum(['piece', 'kg'])
productLabelSchema     = z.enum(['organic', 'local', 'vegetarian', 'vegan'])
```

---

## Suppliers

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/admin/suppliers` | Paginated. `?includeArchived=true` to widen. Filters: `type`, `q`. |
| GET | `/admin/suppliers/:id` | Always returns, archived or not. |
| POST | `/admin/suppliers` | Create. |
| PUT | `/admin/suppliers/:id` | Update. `version` required. |
| POST | `/admin/suppliers/:id/archive` | Archive. `?cascade=true` to also archive its products. |
| POST | `/admin/suppliers/:id/unarchive` | Restore. |

```ts
supplierSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: supplierTypeSchema,
  contactName: z.string().nullish(),
  contactEmail: z.string().email().nullish(),
  contactPhone: z.string().nullish(),
  notes: z.string().nullish(),
  archivedAt: z.date().nullish(),
  productCount: z.number().int(),      // active products
  version: z.number().int(),
  createdAt: z.date(),
})

createSupplierSchema = supplierSchema
  .pick({ name: true, type: true, contactName: true, contactEmail: true, contactPhone: true, notes: true })
updateSupplierSchema = createSupplierSchema.partial().extend({ version: z.number().int() })
```

`POST /admin/suppliers/:id/archive` without `cascade` while active products exist →
`409 Conflict` with `{ activeProductCount }` (FR-024). With `?cascade=true` the supplier
and its products are archived in one transaction.

---

## Categories

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/admin/categories` | List (tree-ish; one nesting level). `?includeArchived=true`. |
| POST | `/admin/categories` | Create. |
| PUT | `/admin/categories/:id` | Rename / reparent. `version` required. |
| POST | `/admin/categories/:id/archive` | Archive ("remove"). Blocked while non-archived products reference it. |
| POST | `/admin/categories/:id/unarchive` | Restore. |

```ts
categorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  parentId: z.string().uuid().nullish(),
  archivedAt: z.date().nullish(),
  productCount: z.number().int(),
  version: z.number().int(),
})
createCategorySchema = z.object({ name: z.string().min(1), parentId: z.string().uuid().nullish() })
updateCategorySchema = createCategorySchema.partial().extend({ version: z.number().int() })
```

`POST /admin/categories/:id/archive` while non-archived products reference it →
`409 Conflict` with `{ productCount }` and a message to reassign first (FR-026).

---

## Products

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/admin/products` | Paginated. `?includeArchived=true`. Filters: `supplierId`, `categoryId`, `saleMode`, `label`, `q` (name/barcode). Sort: `name`, `createdAt`. |
| GET | `/admin/products/:id` | Detail incl. current price and price history. Always returns. |
| POST | `/admin/products` | Create — includes the initial price. |
| PUT | `/admin/products/:id` | Update catalogue fields (not price). `version` required. |
| POST | `/admin/products/:id/price` | Set a new current price (append-only window). |
| POST | `/admin/products/:id/archive` | Archive. |
| POST | `/admin/products/:id/unarchive` | Restore (only if its supplier/category are active). |

```ts
priceWindowSchema = z.object({
  amountEur: z.number().positive(),          // per piece or per kg
  validFrom: z.date(),
  validTo: z.date().nullish(),
  setByName: z.string(),
})

productSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullish(),
  supplier: z.object({ id: z.string().uuid(), name: z.string() }),
  category: z.object({ id: z.string().uuid(), name: z.string() }),
  saleMode: productSaleModeSchema,
  pricingUnit: productPricingUnitSchema,
  photos: z.array(z.string()),
  labels: z.array(productLabelSchema),
  barcode: z.string().nullish(),
  currentPriceEur: z.number().positive().nullish(),
  archivedAt: z.date().nullish(),
  version: z.number().int(),
  createdAt: z.date(),
})

productDetailSchema = productSchema.extend({
  priceHistory: z.array(priceWindowSchema),
  averageWeightGrams: z.number().int().nullish(),
  weightTolerancePercent: z.number().int().nullish(),
})

createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullish(),
  supplierId: z.string().uuid(),
  categoryId: z.string().uuid(),
  saleMode: productSaleModeSchema,
  photos: z.array(z.string()).default([]),
  labels: z.array(productLabelSchema).default([]),
  barcode: z.string().nullish(),
  averageWeightGrams: z.number().int().positive().nullish(),
  weightTolerancePercent: z.number().int().positive().nullish(),
  initialPriceEur: z.number().positive(),
}).meta({
  title: 'CreateProduct',
  description: 'Create a catalogue product with its first price. pricingUnit is derived from saleMode.',
  examples: [{
    name: 'Carrots (loose)', supplierId: '…', categoryId: '…',
    saleMode: 'weight', labels: ['local', 'organic'], initialPriceEur: 2.4,
  }],
})

updateProductSchema = createProductSchema
  .omit({ initialPriceEur: true })
  .partial()
  .extend({ version: z.number().int() })

setProductPriceSchema = z.object({
  amountEur: z.number().positive(),
  effectiveFrom: z.date().default(() => new Date()),
})
```

Rules:
- `pricingUnit` is derived server-side: `weight → kg`, `unit → piece`. Not client-supplied.
- `POST /admin/products` creates the product and one open `ProductPrice`
  (`validTo = null`) in one transaction.
- `POST /admin/products/:id/price` closes the current open row (`validTo = effectiveFrom`)
  and inserts a new open row, in one transaction (FR-030). `effectiveFrom` must be ≥ the
  current row's `validFrom`.
- Changing `saleMode` via `PUT` is allowed only when it does not contradict an existing
  price meaning; the SPA re-confirms the price unit (edge case in spec).
- `unarchive` a product whose supplier or category is archived → `409` with which parent
  blocks it.

---

## e2e coverage (`catalog.controller.e2e-spec.ts`)

Built from `posts.controller.e2e-spec.ts`, admin session via `createUserWithSession` +
role set to `admin`:

- create supplier → create category → create a `unit` product and a `weight` product with
  initial prices; `currentPriceEur` reflects them; `weight` product has `pricingUnit = kg`.
- set a new price twice → `priceHistory` has three windows, exactly one with `validTo =
  null`, and the closed windows are contiguous.
- archive a product → absent from `GET /admin/products`, present with
  `?includeArchived=true`, still returned by `GET /admin/products/:id`.
- archive a supplier with active products without `cascade` → `409` with the count; with
  `?cascade=true` → supplier and products archived.
- archive a category referenced by an active product → `409`.
- update with stale `version` → `409`.
- non-admin → `403`; unauthenticated → `401`.
