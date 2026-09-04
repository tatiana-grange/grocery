import { z } from 'zod'

export const referentSchema = z
  .object({
    id: z.string().uuid(),
    firstName: z.string().nullish(),
    lastName: z.string(),
    contactEmail: z.string().email().nullish(),
    contactPhone: z.string().nullish(),
    userId: z.string().uuid().nullish(),
    supplierCount: z.number().int(),
    version: z.number().int(),
    createdAt: z.date(),
  })
  .meta({
    title: 'CatalogReferent',
    description: 'The co-op member who follows a supplier',
  })

export type Referent = z.infer<typeof referentSchema>

export const referentsListSchema = z.array(referentSchema).meta({
  title: 'CatalogReferentsList',
  description: 'All referents',
})
export type ReferentsList = z.infer<typeof referentsListSchema>

export const createReferentSchema = z
  .object({
    firstName: z.string().nullish(),
    lastName: z.string().min(1),
    contactEmail: z.string().email().nullish(),
    contactPhone: z.string().nullish(),
    userId: z.string().uuid().nullish(),
  })
  .meta({
    title: 'CreateReferent',
    description: 'Create a referent',
    examples: [{ lastName: 'Grolleau' }],
  })

export type CreateReferentInput = z.infer<typeof createReferentSchema>

export const updateReferentSchema = createReferentSchema
  .partial()
  .extend({ version: z.number().int() })
  .meta({ title: 'UpdateReferent', description: 'Update a referent (send the loaded version)' })

export type UpdateReferentInput = z.infer<typeof updateReferentSchema>
