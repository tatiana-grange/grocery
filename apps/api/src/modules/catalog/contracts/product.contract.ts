import {
  createFilterQueryStringSchema,
  createPaginationQuerySchema,
  createSortingQueryStringSchema,
  paginatedSchema,
} from '@lonestone/nzoth/server'
import { z } from 'zod'
import { priceWindowSchema } from './product-price.contract'

export const PRODUCT_SALE_MODES = ['unit', 'weight'] as const
export const productSaleModeSchema = z.enum(PRODUCT_SALE_MODES).meta({
  title: 'ProductSaleMode',
  description: '"unit" is sold per piece, "weight" is priced per kilogram',
})
export type ProductSaleMode = z.infer<typeof productSaleModeSchema>

export const PRODUCT_PRICING_UNITS = ['piece', 'kg'] as const
export const productPricingUnitSchema = z.enum(PRODUCT_PRICING_UNITS).meta({
  title: 'ProductPricingUnit',
  description: 'Derived from the sale mode: unit → piece, weight → kg',
})
export type ProductPricingUnit = z.infer<typeof productPricingUnitSchema>

export const PRODUCT_LABELS = ['organic', 'local', 'vegetarian', 'vegan'] as const
export const productLabelSchema = z.enum(PRODUCT_LABELS).meta({
  title: 'ProductLabel',
  description: 'Informational badges shown on the product',
})
export type ProductLabel = z.infer<typeof productLabelSchema>

const productRefSchema = z.object({ id: z.string().uuid(), name: z.string() })

export const productSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullish(),
    supplier: productRefSchema,
    category: productRefSchema,
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
  .meta({ title: 'CatalogProduct', description: 'An item the cooperative offers' })

export type Product = z.infer<typeof productSchema>

export const productDetailSchema = productSchema
  .extend({
    priceHistory: z.array(priceWindowSchema),
    averageWeightGrams: z.number().int().nullish(),
    weightTolerancePercent: z.number().int().nullish(),
  })
  .meta({ title: 'CatalogProductDetail', description: 'A product with its full price history' })

export type ProductDetail = z.infer<typeof productDetailSchema>

export const productsListSchema = paginatedSchema(productSchema).meta({
  title: 'CatalogProductsList',
  description: 'A paginated list of products',
})
export type ProductsList = z.infer<typeof productsListSchema>

export const createProductSchema = z
  .object({
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
  })
  .meta({
    title: 'CreateProduct',
    description: 'Create a catalogue product with its first price. pricingUnit is derived from saleMode.',
    examples: [
      {
        name: 'Carrots (loose)',
        supplierId: '00000000-0000-0000-0000-000000000000',
        categoryId: '00000000-0000-0000-0000-000000000000',
        saleMode: 'weight',
        labels: ['local', 'organic'],
        initialPriceEur: 2.4,
      },
    ],
  })

export type CreateProductInput = z.infer<typeof createProductSchema>

export const updateProductSchema = createProductSchema
  .omit({ initialPriceEur: true })
  .partial()
  .extend({ version: z.number().int() })
  .meta({ title: 'UpdateProduct', description: 'Update a product (not its price)' })

export type UpdateProductInput = z.infer<typeof updateProductSchema>

export const enabledProductSortingKeys = ['name', 'createdAt'] as const
export const productSortingSchema = createSortingQueryStringSchema(enabledProductSortingKeys)
export type ProductSorting = z.infer<typeof productSortingSchema>

export const enabledProductFilteringKeys = [
  'supplierId',
  'categoryId',
  'saleMode',
  'label',
  'q',
] as const
export const productFilteringSchema = createFilterQueryStringSchema(enabledProductFilteringKeys)
export type ProductFiltering = z.infer<typeof productFilteringSchema>

export const productPaginationSchema = createPaginationQuerySchema()
export type ProductPagination = z.infer<typeof productPaginationSchema>
