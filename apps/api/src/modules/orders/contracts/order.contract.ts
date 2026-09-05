import { z } from 'zod'

export const ORDERING_MODE_CHOICES = ['pre_order', 'in_store'] as const
export const orderingModeChoiceSchema = z.enum(ORDERING_MODE_CHOICES).meta({
  title: 'OrderingModeChoice',
  description:
    'One concrete ordering type — never "both". Types a cart line and an order. ' +
    'A product that supports "both" is resolved to one of these when the member adds it to the cart.',
})
export type OrderingModeChoice = z.infer<typeof orderingModeChoiceSchema>

export const CART_LINE_INVALID_REASON_CODES = [
  'product_archived',
  'ordering_mode_unavailable',
] as const
export const cartLineInvalidReasonCodeSchema = z.enum(CART_LINE_INVALID_REASON_CODES).meta({
  title: 'CartLineInvalidReasonCode',
  description:
    'Why a cart line is no longer orderable — the frontend maps this to a translated message.',
})
export type CartLineInvalidReasonCode = z.infer<typeof cartLineInvalidReasonCodeSchema>

export const ORDER_STATUSES = ['pending', 'cancelled'] as const
export const orderStatusSchema = z.enum(ORDER_STATUSES).meta({
  title: 'OrderStatus',
  description:
    'pending is the only starting value in lot 2; later lots add processing/fulfilment values to this same field',
})
export type OrderStatus = z.infer<typeof orderStatusSchema>

export const orderLineSchema = z
  .object({
    id: z.string().uuid(),
    productName: z.string(),
    quantity: z.number().positive(),
    unitPriceEur: z.number().nonnegative(),
    lineTotalEur: z.number().nonnegative(),
  })
  .meta({ title: 'OrderLine', description: 'An immutable snapshot, taken at checkout' })

export type OrderLine = z.infer<typeof orderLineSchema>

export const orderSchema = z
  .object({
    id: z.string().uuid(),
    orderingMode: orderingModeChoiceSchema,
    status: orderStatusSchema,
    totalEur: z.number().nonnegative(),
    placedAt: z.date(),
    cancelledAt: z.date().nullish(),
    version: z.number().int(),
  })
  .meta({ title: 'Order' })

export type Order = z.infer<typeof orderSchema>

export const orderDetailSchema = orderSchema
  .extend({ lines: z.array(orderLineSchema) })
  .meta({ title: 'OrderDetail' })

export type OrderDetail = z.infer<typeof orderDetailSchema>

export const checkoutResultSchema = z
  .object({
    orders: z.array(orderDetailSchema),
    droppedLines: z.array(
      z.object({ productName: z.string(), reasonCode: cartLineInvalidReasonCodeSchema }),
    ),
  })
  .meta({
    title: 'CheckoutResult',
    description:
      'One order per ordering type present in the cart. droppedLines lists products removed ' +
      'from checkout because they became unorderable (archived, or no longer offering the ' +
      "cart line's ordering mode) since they were added.",
  })

export type CheckoutResult = z.infer<typeof checkoutResultSchema>
