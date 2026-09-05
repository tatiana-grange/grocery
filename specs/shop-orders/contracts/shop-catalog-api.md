# Contract: Public Shop (catalog module addition)

New `@Public()` read surface on the existing `catalog` module. The existing
`admin/suppliers*`, `admin/categories*`, `admin/products*` controllers are untouched — this
is a second, narrower set of controllers over the same data. Schemas are Zod outlines; the
real `contracts/*.contract.ts` files carry `.meta()` and export inferred types, following
lot 1's pattern.

---

## Enum addition

```ts
productOrderingModeSchema = z.enum(['pre_order', 'in_store', 'both']).meta({
  title: 'ProductOrderingMode',
  description:
    'pre_order = ordered ahead from the producer for a future delivery; ' +
    'in_store = bought from what the cooperative currently has on the shelf; ' +
    'both = the member picks one when adding it to their cart',
})
```

Added to `productSchema`, `createProductSchema`, `updateProductSchema` in the existing
`catalog/contracts/product.contract.ts`. `createProductSchema.orderingMode` is required
(no default) — an admin must decide it explicitly, same as `saleMode`.

---

## Shop routes

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/shop/categories` | `@Public()` | Categories that currently have ≥1 orderable product. |
| GET | `/shop/products` | `@Public()` | Paginated, filterable, sortable product list. |
| GET | `/shop/products/:id` | `@Public()` | Product detail. `404` if archived or the id doesn't exist — no "this exists but you can't see it" leak. |

### `GET /shop/categories`

```ts
shopCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
}).meta({ title: 'ShopCategory' })

shopCategoriesListSchema = z.array(shopCategorySchema)
```

Service rule: a category is included only if it has at least one product where
`archivedAt IS NULL` (FR-002, SC-002). No pagination — category counts are small.

### `GET /shop/products`

Query: reuses the pagination/sorting/filtering helpers from `@lonestone/nzoth/server`,
same shape as the admin product list.

```ts
enabledShopProductSortingKeys = ['name', 'createdAt'] as const   // FR-004
enabledShopProductFilteringKeys = ['categoryId', 'q'] as const   // FR-003 (q matches name OR barcode)
```

```ts
shopProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  category: z.object({ id: z.string().uuid(), name: z.string() }),
  saleMode: productSaleModeSchema,
  pricingUnit: productPricingUnitSchema,
  photos: z.array(z.string()),
  labels: z.array(productLabelSchema),
  currentPriceEur: z.number().positive(),
  orderingMode: productOrderingModeSchema,
}).meta({ title: 'ShopProduct', description: 'A product as shown in the public shop list' })

shopProductsListSchema = paginatedSchema(shopProductSchema)
```

Service rule: only `archivedAt IS NULL` products are returned, regardless of
`orderingMode` (a product with no current stock concept yet is still "orderable" — real
stock enforcement is lot 3, per spec Assumptions).

### `GET /shop/products/:id`

```ts
shopProductDetailSchema = shopProductSchema.extend({
  description: z.string().nullish(),
  barcode: z.string().nullish(),
}).meta({ title: 'ShopProductDetail' })
```

Deliberately narrower than the admin `ProductDetail` — no price history, no supplier
detail, no version field. FR-005 only asks for photos, description, current price, sale
unit, and labels; `orderingMode` and `barcode` are added because US1/US2 need them
(search by barcode, and knowing which ordering type(s) apply before adding to cart).

---

## Errors

| Status | When |
| --- | --- |
| `404` | Product id doesn't exist, or exists but is archived. |
| `400` | Invalid query (bad sort key, bad pagination). |

No `401`/`403` on any `/shop/*` route — they are `@Public()` by design (FR-001).
