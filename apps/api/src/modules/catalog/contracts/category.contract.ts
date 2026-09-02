import { z } from 'zod'

export const categorySchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    parentId: z.string().uuid().nullish(),
    archivedAt: z.date().nullish(),
    productCount: z.number().int(),
    version: z.number().int(),
  })
  .meta({ title: 'CatalogCategory', description: 'A grouping for products in the catalogue' })

export type Category = z.infer<typeof categorySchema>

export const categoriesListSchema = z.array(categorySchema).meta({
  title: 'CatalogCategoriesList',
  description: 'All categories (one nesting level)',
})
export type CategoriesList = z.infer<typeof categoriesListSchema>

export const createCategorySchema = z
  .object({
    name: z.string().min(1),
    parentId: z.string().uuid().nullish(),
  })
  .meta({
    title: 'CreateCategory',
    description: 'Create a category',
    examples: [{ name: 'Fruits & vegetables' }],
  })

export type CreateCategoryInput = z.infer<typeof createCategorySchema>

export const updateCategorySchema = createCategorySchema
  .partial()
  .extend({ version: z.number().int() })
  .meta({ title: 'UpdateCategory', description: 'Rename or reparent a category' })

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
