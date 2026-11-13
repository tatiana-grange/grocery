import {
  createFilterQueryStringSchema,
  createPaginationQuerySchema,
  paginatedSchema,
} from '@lonestone/nzoth/server'
import { z } from 'zod'
import { productSaleModeSchema } from '../../catalog/contracts/product.contract'

export const STOCK_MOVEMENT_REASONS = [
  'reception',
  'distribution',
  'distribution_reversal',
] as const
export const stockMovementReasonSchema = z.enum(STOCK_MOVEMENT_REASONS).meta({
  title: 'StockMovementReason',
  description:
    'reception adds stock, distribution removes it, distribution_reversal puts back what a ' +
    'reversed handover took. A later inventory increment adds adjustment and ' +
    'count_correction to this same field.',
})
export type StockMovementReason = z.infer<typeof stockMovementReasonSchema>

export const stockSummarySchema = z
  .object({
    product: z.object({
      id: z.string().uuid(),
      name: z.string(),
      saleMode: productSaleModeSchema,
    }),
    // Signed, not `nonnegative()`: a handover may take stock below zero, because at the
    // table the shelf is the source of truth (research.md §6). Bounding it here would make
    // the API fail its own response validation the first time that happens.
    quantityOnHand: z.number(),
    costPriceEur: z.number().nonnegative().nullish(),
  })
  .meta({ title: 'StockSummary' })
export type StockSummary = z.infer<typeof stockSummarySchema>

export const stockListSchema = paginatedSchema(stockSummarySchema).meta({
  title: 'StockList',
  description: 'A paginated list of every product with its current stock level and cost price',
})
export type StockList = z.infer<typeof stockListSchema>

export const stockMovementSchema = z
  .object({
    id: z.string().uuid(),
    quantity: z.number(),
    unitCostEur: z.number().nonnegative(),
    reason: stockMovementReasonSchema,
    receptionLineId: z.string().uuid().nullish(),
    createdAt: z.date(),
  })
  .meta({ title: 'StockMovement' })
export type StockMovement = z.infer<typeof stockMovementSchema>

export const stockDetailSchema = stockSummarySchema
  .extend({
    movements: z.array(stockMovementSchema),
  })
  .meta({ title: 'StockDetail' })
export type StockDetail = z.infer<typeof stockDetailSchema>

export const enabledStockFilteringKeys = ['search', 'categoryId'] as const
export const stockFilteringSchema = createFilterQueryStringSchema(enabledStockFilteringKeys)
export type StockFiltering = z.infer<typeof stockFilteringSchema>

export const stockPaginationSchema = createPaginationQuerySchema()
export type StockPagination = z.infer<typeof stockPaginationSchema>
