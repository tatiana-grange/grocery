import { z } from 'zod'

export const ORDERING_MODE_CHOICES = ['pre_order', 'in_store'] as const
export const orderingModeChoiceSchema = z.enum(ORDERING_MODE_CHOICES).meta({
  title: 'OrderingModeChoice',
  description:
    'One concrete ordering type — never "both". Types a cart line and an order. ' +
    'A product that supports "both" is resolved to one of these when the member adds it to the cart.',
})
export type OrderingModeChoice = z.infer<typeof orderingModeChoiceSchema>

export const ORDER_STATUSES = ['pending', 'cancelled'] as const
export const orderStatusSchema = z.enum(ORDER_STATUSES).meta({
  title: 'OrderStatus',
  description:
    'pending is the only starting value in lot 2; later lots add processing/fulfilment values to this same field',
})
export type OrderStatus = z.infer<typeof orderStatusSchema>
