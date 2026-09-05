import { paginatedSchema } from '@lonestone/nzoth/server'
import { z } from 'zod'
import { productSaleModeSchema } from '../../catalog/contracts/product.contract'
import { discrepancyKindSchema, receptionSchema } from './reception.contract'

// ============================================================================================
// Enums (contract-level only — never on the entity, per Principle I)
// ============================================================================================

export const SUPPLIER_ORDER_STATUSES = ['draft', 'sent', 'received', 'closed'] as const
export const supplierOrderStatusSchema = z.enum(SUPPLIER_ORDER_STATUSES).meta({
  title: 'SupplierOrderStatus',
  description:
    'draft: just aggregated, lines can still change on the next aggregation run for other ' +
    'products. sent: fixed, awaiting delivery. received: every line fully delivered ' +
    '(automatic). closed: staff ended it early, some lines may be short (FR-023).',
})
export type SupplierOrderStatus = z.infer<typeof supplierOrderStatusSchema>

export { discrepancyKindSchema } from './reception.contract'
export type { DiscrepancyKind } from './reception.contract'

// ============================================================================================
// Reads
// ============================================================================================

export const supplierOrderLineSchema = z
  .object({
    id: z.string().uuid(),
    product: z.object({
      id: z.string().uuid(),
      name: z.string(),
      saleMode: productSaleModeSchema,
    }),
    quantity: z.number().positive(),
    receivedQuantity: z.number().nonnegative(),
    discrepancy: discrepancyKindSchema,
    contributingMemberCount: z.number().int().nonnegative(),
    estimatedUnitCostEur: z.number().nonnegative().nullish(),
  })
  .meta({ title: 'SupplierOrderLine' })

export type SupplierOrderLine = z.infer<typeof supplierOrderLineSchema>

export const supplierOrderSchema = z
  .object({
    id: z.string().uuid(),
    supplier: z.object({ id: z.string().uuid(), name: z.string() }),
    status: supplierOrderStatusSchema,
    sentAt: z.date().nullish(),
    closedAt: z.date().nullish(),
    estimatedTotalEur: z.number().nonnegative(),
    hasUnknownCostLines: z.boolean(),
    lineCount: z.number().int().nonnegative(),
    version: z.number().int(),
    createdAt: z.date(),
  })
  .meta({ title: 'SupplierOrder' })

export type SupplierOrder = z.infer<typeof supplierOrderSchema>

export const supplierOrderDetailSchema = supplierOrderSchema
  .extend({
    lines: z.array(supplierOrderLineSchema),
    receptions: z.array(receptionSchema),
  })
  .meta({ title: 'SupplierOrderDetail' })

export type SupplierOrderDetail = z.infer<typeof supplierOrderDetailSchema>

export const supplierOrdersListSchema = paginatedSchema(supplierOrderSchema).meta({
  title: 'SupplierOrdersList',
  description: 'A paginated list of supplier orders',
})
export type SupplierOrdersList = z.infer<typeof supplierOrdersListSchema>

export const aggregateResultSchema = z
  .object({
    supplierOrder: supplierOrderDetailSchema,
    skippedLines: z.array(
      z.object({
        productName: z.string(),
        reason: z.string(),
      }),
    ),
  })
  .meta({
    title: 'AggregateResult',
    description:
      'The draft supplier order aggregation just created, plus every pending pre-order line ' +
      'left out because its product can no longer be ordered from this supplier (FR-003).',
  })
export type AggregateResult = z.infer<typeof aggregateResultSchema>

// ============================================================================================
// Writes
// ============================================================================================

export const sendSupplierOrderSchema = z
  .object({ version: z.number().int() })
  .meta({
    title: 'SendSupplierOrder',
    description: 'Mark a draft supplier order as sent (send the loaded version)',
  })
export type SendSupplierOrderInput = z.infer<typeof sendSupplierOrderSchema>

export const closeSupplierOrderSchema = z.object({ version: z.number().int() }).meta({
  title: 'CloseSupplierOrder',
  description: 'Close a sent supplier order early (send the loaded version)',
})
export type CloseSupplierOrderInput = z.infer<typeof closeSupplierOrderSchema>
