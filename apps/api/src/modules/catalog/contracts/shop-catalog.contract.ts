import {
  createFilterQueryStringSchema,
  createPaginationQuerySchema,
  createSortingQueryStringSchema,
  paginatedSchema,
} from '@lonestone/nzoth/server'
import { z } from 'zod'
import {
  productLabelSchema,
  productOrderingModeSchema,
  productPricingUnitSchema,
  productSaleModeSchema,
  productSelectionUnitSchema,
} from './product.contract'

export const shopCategorySchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    /** `null` for a top-level category. The tree is one level deep (see the Category entity). */
    parentId: z.string().uuid().nullable(),
    /** Orderable products filed directly under this category — not counting its children. */
    productCount: z.number().int().nonnegative(),
  })
  .meta({
    title: 'ShopCategory',
    description:
      'A category that has orderable products in it or under one of its children. Selecting a ' +
      'top-level category filters to its products and every child category’s products.',
  })

export type ShopCategory = z.infer<typeof shopCategorySchema>

export const shopCategoriesListSchema = z.array(shopCategorySchema).meta({
  title: 'ShopCategoriesList',
  description: 'Categories that currently have at least one orderable product',
})
export type ShopCategoriesList = z.infer<typeof shopCategoriesListSchema>

export const shopProductSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    category: z.object({ id: z.string().uuid(), name: z.string() }),
    saleMode: productSaleModeSchema,
    pricingUnit: productPricingUnitSchema,
    /** Display unit for the quantity picker on a by-weight product ('g' or 'kg'). */
    selectionUnit: productSelectionUnitSchema,
    /** The +/- step of the quantity picker for a by-weight product, in grams. */
    quantityStepGrams: z.number().int().positive(),
    photos: z.array(z.string()),
    labels: z.array(productLabelSchema),
    currentPriceEur: z.number().positive(),
    orderingMode: productOrderingModeSchema,
    /**
     * What the last receptions put on the shelf, in the cart's own unit (whole pieces, or
     * kilograms for a by-weight product). `0` covers both "never received" and "the ledger
     * nets to nothing", which the shop treats the same way: it shows no stock line at all.
     *
     * Receptions are the only thing that writes to the stock ledger today, so this number
     * never goes down when members order. Read it as "what arrived", not "what is left".
     */
    quantityOnHand: z.number().nonnegative(),
  })
  .meta({ title: 'ShopProduct', description: 'A product as shown in the public shop list' })

export type ShopProduct = z.infer<typeof shopProductSchema>

export const shopProductsListSchema = paginatedSchema(shopProductSchema).meta({
  title: 'ShopProductsList',
  description: 'A paginated list of orderable products',
})
export type ShopProductsList = z.infer<typeof shopProductsListSchema>

export const shopProductDetailSchema = shopProductSchema
  .extend({
    description: z.string().nullish(),
    barcode: z.string().nullish(),
  })
  .meta({
    title: 'ShopProductDetail',
    description: 'A product detail page shown in the public shop — narrower than the admin detail',
  })

export type ShopProductDetail = z.infer<typeof shopProductDetailSchema>

export const enabledShopProductSortingKeys = ['name', 'createdAt'] as const
export const shopProductSortingSchema = createSortingQueryStringSchema(
  enabledShopProductSortingKeys,
)
export type ShopProductSorting = z.infer<typeof shopProductSortingSchema>

export const enabledShopProductFilteringKeys = ['categoryId', 'q'] as const
export const shopProductFilteringSchema = createFilterQueryStringSchema(
  enabledShopProductFilteringKeys,
)
export type ShopProductFiltering = z.infer<typeof shopProductFilteringSchema>

export const shopProductPaginationSchema = createPaginationQuerySchema()
export type ShopProductPagination = z.infer<typeof shopProductPaginationSchema>
