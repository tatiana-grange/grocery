import {
  createFilterQueryStringSchema,
  createPaginationQuerySchema,
  paginatedSchema,
} from '@lonestone/nzoth/server'
import { z } from 'zod'
import {
  productSaleModeSchema,
  productSelectionUnitSchema,
} from '../../catalog/contracts/product.contract'
import { memberStatusSchema } from '../../members/contracts/member.contract'
import { orderingModeChoiceSchema } from '../../orders/contracts/order.contract'

export const NOT_READY_REASON_CODES = ['awaiting_reception'] as const
export const notReadyReasonCodeSchema = z.enum(NOT_READY_REASON_CODES).meta({
  title: 'NotReadyReasonCode',
  description:
    'Why a line cannot be handed over yet — the frontend maps this to a translated message.',
})
export type NotReadyReasonCode = z.infer<typeof notReadyReasonCodeSchema>

export const distributionMemberSummarySchema = z
  .object({
    id: z.string().uuid(),
    membershipNumber: z.string(),
    name: z.string(),
    status: memberStatusSchema,
    /** Always the sum of the member's wallet entries; never negative (SC-010). */
    balanceEur: z.number(),
    outstandingOrderCount: z.number().int().nonnegative(),
  })
  .meta({
    title: 'DistributionMemberSummary',
    description: 'One member as the distribution table sees them in a search result',
  })
export type DistributionMemberSummary = z.infer<typeof distributionMemberSummarySchema>

export const distributionMemberListSchema = paginatedSchema(distributionMemberSummarySchema).meta({
  title: 'DistributionMemberList',
})
export type DistributionMemberList = z.infer<typeof distributionMemberListSchema>

export const distributionLineSchema = z
  .object({
    orderLineId: z.string().uuid(),
    productId: z.string().uuid(),
    /** The checkout snapshot, so the line still reads sensibly after a rename. */
    productName: z.string(),
    saleMode: productSaleModeSchema,
    selectionUnit: productSelectionUnitSchema.nullish(),
    quantityStepGrams: z.number().int().nullish(),
    orderedQuantity: z.number(),
    /** The product's current stock on hand — may be negative (research.md §10). */
    availableQuantity: z.number(),
    /** The price recorded when the order was placed, not today's price (FR-007). */
    unitPriceEur: z.number().nonnegative(),
    lineTotalEur: z.number().nonnegative(),
    isReady: z.boolean(),
    notReadyReason: notReadyReasonCodeSchema.nullish(),
  })
  .meta({ title: 'DistributionLine' })
export type DistributionLine = z.infer<typeof distributionLineSchema>

export const distributionOrderSchema = z
  .object({
    id: z.string().uuid(),
    orderingMode: orderingModeChoiceSchema,
    placedAt: z.date(),
    totalEur: z.number().nonnegative(),
    /** Every line ready — a pre-order line needs its goods to have arrived (FR-003). */
    isReady: z.boolean(),
    /** Sent back on validate so a concurrent handover is refused (FR-011). */
    version: z.number().int(),
    lines: z.array(distributionLineSchema),
  })
  .meta({ title: 'DistributionOrder' })
export type DistributionOrder = z.infer<typeof distributionOrderSchema>

export const distributionMemberScreenSchema = distributionMemberSummarySchema
  .extend({
    orders: z.array(distributionOrderSchema),
  })
  .meta({
    title: 'DistributionMemberScreen',
    description:
      'One member’s outstanding orders, balance and status — the whole table screen in one ' +
      'call. A member with nothing outstanding returns an empty order list, not a 404.',
  })
export type DistributionMemberScreen = z.infer<typeof distributionMemberScreenSchema>

export const distributionProductSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    barcode: z.string().nullish(),
    saleMode: productSaleModeSchema,
    selectionUnit: productSelectionUnitSchema.nullish(),
    quantityStepGrams: z.number().int().nullish(),
    /** The current price — an express line is priced at the table (FR-015). */
    unitPriceEur: z.number().nonnegative(),
    /** May be negative; the screen warns but never blocks (FR-018). */
    quantityOnHand: z.number(),
  })
  .meta({
    title: 'DistributionProduct',
    description: 'A product a staffer can sell at the table, with its price and current stock',
  })
export type DistributionProduct = z.infer<typeof distributionProductSchema>

export const distributionProductListSchema = paginatedSchema(distributionProductSchema).meta({
  title: 'DistributionProductList',
})
export type DistributionProductList = z.infer<typeof distributionProductListSchema>

export const waitingOrderSchema = z
  .object({
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
  })
  .meta({ title: 'WaitingOrder', description: 'One order still waiting to be handed over' })
export type WaitingOrder = z.infer<typeof waitingOrderSchema>

export const waitingOrderListSchema = paginatedSchema(waitingOrderSchema).meta({
  title: 'WaitingOrderList',
  description: 'Orders still to hand over. A fully handed-over order leaves this list.',
})
export type WaitingOrderList = z.infer<typeof waitingOrderListSchema>

export const enabledDistributionMemberFilteringKeys = ['search'] as const
export const distributionMemberFilteringSchema = createFilterQueryStringSchema(
  enabledDistributionMemberFilteringKeys,
)
export type DistributionMemberFiltering = z.infer<typeof distributionMemberFilteringSchema>

export const enabledDistributionProductFilteringKeys = ['search', 'categoryId'] as const
export const distributionProductFilteringSchema = createFilterQueryStringSchema(
  enabledDistributionProductFilteringKeys,
)
export type DistributionProductFiltering = z.infer<typeof distributionProductFilteringSchema>

export const enabledWaitingFilteringKeys = [
  'orderingMode',
  'readyOnly',
  'placedFrom',
  'placedTo',
] as const
export const waitingFilteringSchema = createFilterQueryStringSchema(enabledWaitingFilteringKeys)
export type WaitingFiltering = z.infer<typeof waitingFilteringSchema>

export const distributionPaginationSchema = createPaginationQuerySchema()
export type DistributionPagination = z.infer<typeof distributionPaginationSchema>
