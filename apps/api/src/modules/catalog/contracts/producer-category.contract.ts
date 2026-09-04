import { z } from 'zod'

export const producerCategorySchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    archivedAt: z.date().nullish(),
    supplierCount: z.number().int(),
    version: z.number().int(),
  })
  .meta({
    title: 'CatalogProducerCategory',
    description: 'A tag for what a supplier produces (e.g. "Boissons", "Fromages")',
  })

export type ProducerCategory = z.infer<typeof producerCategorySchema>

export const producerCategoriesListSchema = z.array(producerCategorySchema).meta({
  title: 'CatalogProducerCategoriesList',
  description: 'All producer categories',
})
export type ProducerCategoriesList = z.infer<typeof producerCategoriesListSchema>

export const createProducerCategorySchema = z
  .object({
    name: z.string().min(1),
  })
  .meta({
    title: 'CreateProducerCategory',
    description: 'Create a producer category',
    examples: [{ name: 'Boissons' }],
  })

export type CreateProducerCategoryInput = z.infer<typeof createProducerCategorySchema>

export const updateProducerCategorySchema = createProducerCategorySchema
  .partial()
  .extend({ version: z.number().int() })
  .meta({
    title: 'UpdateProducerCategory',
    description: 'Rename a producer category',
  })

export type UpdateProducerCategoryInput = z.infer<typeof updateProducerCategorySchema>
