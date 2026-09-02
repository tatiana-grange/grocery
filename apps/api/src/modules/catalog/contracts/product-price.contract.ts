import { z } from 'zod'

/** A price window: amount is per piece or per kilogram depending on the product's sale mode. */
export const priceWindowSchema = z
  .object({
    id: z.string().uuid(),
    amountEur: z.number().positive(),
    currency: z.string(),
    validFrom: z.date(),
    validTo: z.date().nullish(),
    setByName: z.string().nullish(),
  })
  .meta({ title: 'CatalogPriceWindow', description: 'One entry in a product’s price history' })

export type PriceWindow = z.infer<typeof priceWindowSchema>

export const setProductPriceSchema = z
  .object({
    amountEur: z.number().positive(),
    effectiveFrom: z.coerce.date().optional(),
  })
  .meta({
    title: 'SetProductPrice',
    description: 'Set a new current price; the previous window is closed at effectiveFrom (or now)',
    examples: [{ amountEur: 2.4 }],
  })

export type SetProductPriceInput = z.infer<typeof setProductPriceSchema>
