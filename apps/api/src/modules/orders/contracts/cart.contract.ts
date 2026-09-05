import { z } from 'zod'
import { productSaleModeSchema } from '../../catalog/contracts/product.contract'
import { cartLineInvalidReasonCodeSchema, orderingModeChoiceSchema } from './order.contract'

export const cartLineSchema = z
  .object({
    id: z.string().uuid(),
    product: z.object({
      id: z.string().uuid(),
      name: z.string(),
      saleMode: productSaleModeSchema,
      photos: z.array(z.string()),
    }),
    orderingMode: orderingModeChoiceSchema,
    quantity: z.number().positive(),
    unitPriceEur: z.number().nonnegative(),
    lineTotalEur: z.number().nonnegative(),
    isValid: z.boolean(),
    invalidReasonCode: cartLineInvalidReasonCodeSchema.nullish(),
  })
  .meta({
    title: 'CartLine',
    description:
      "A line in the caller's cart. isValid is false once the product is archived or no " +
      'longer offers this ordering mode — the line is still returned, not dropped, until checkout.',
  })

export type CartLine = z.infer<typeof cartLineSchema>

export const cartSchema = z
  .object({
    id: z.string().uuid(),
    lines: z.array(cartLineSchema),
    totalEur: z.number().nonnegative(),
    version: z.number().int(),
  })
  .meta({ title: 'Cart', description: 'The sum of its valid lines' })

export type Cart = z.infer<typeof cartSchema>

export const addCartLineSchema = z
  .object({
    productId: z.string().uuid(),
    orderingMode: orderingModeChoiceSchema,
    quantity: z.number().positive(),
  })
  .meta({
    title: 'AddCartLine',
    description:
      'quantity is a piece count (integer) for a unit-sale product, or kilograms (up to 3 ' +
      'decimals) for a by-weight product',
  })

export type AddCartLineInput = z.infer<typeof addCartLineSchema>

export const updateCartLineSchema = z
  .object({ quantity: z.number().positive() })
  .meta({ title: 'UpdateCartLine', description: "Change a line's quantity" })

export type UpdateCartLineInput = z.infer<typeof updateCartLineSchema>
