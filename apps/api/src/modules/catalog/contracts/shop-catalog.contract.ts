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
} from './product.contract'

export const shopCategorySchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
  })
  .meta({ title: 'ShopCategory', description: 'A category with at least one orderable product' })

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
    photos: z.array(z.string()),
    labels: z.array(productLabelSchema),
    currentPriceEur: z.number().positive(),
    orderingMode: productOrderingModeSchema,
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
