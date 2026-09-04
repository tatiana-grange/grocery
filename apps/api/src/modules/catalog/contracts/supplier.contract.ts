import {
  createFilterQueryStringSchema,
  createPaginationQuerySchema,
  paginatedSchema,
} from '@lonestone/nzoth/server'
import { z } from 'zod'

export const SUPPLIER_TYPES = ['producer', 'wholesaler'] as const
export const supplierTypeSchema = z.enum(SUPPLIER_TYPES).meta({
  title: 'SupplierType',
  description: 'Whether the supplier is a producer or a wholesaler',
})
export type SupplierType = z.infer<typeof supplierTypeSchema>

export const SUPPLIER_DELIVERY_MODES = ['livraison', 'collecte'] as const
export const supplierDeliveryModeSchema = z.enum(SUPPLIER_DELIVERY_MODES).meta({
  title: 'SupplierDeliveryMode',
  description:
    'Whether the supplier delivers to the épicerie ("livraison") or a member picks the order up ("collecte")',
})
export type SupplierDeliveryMode = z.infer<typeof supplierDeliveryModeSchema>

const supplierReferentRefSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().nullish(),
  lastName: z.string(),
})

const supplierProducerCategoryRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
})

export const supplierSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    type: supplierTypeSchema,
    contactName: z.string().nullish(),
    contactEmail: z.string().email().nullish(),
    contactPhone: z.string().nullish(),
    notes: z.string().nullish(),
    deliveryMode: supplierDeliveryModeSchema.nullish(),
    referent: supplierReferentRefSchema.nullish(),
    producerCategories: z.array(supplierProducerCategoryRefSchema),
    archivedAt: z.date().nullish(),
    productCount: z.number().int(),
    version: z.number().int(),
    createdAt: z.date(),
  })
  .meta({ title: 'CatalogSupplier', description: 'A source of products' })

export type Supplier = z.infer<typeof supplierSchema>

export const suppliersListSchema = paginatedSchema(supplierSchema).meta({
  title: 'CatalogSuppliersList',
  description: 'A paginated list of suppliers',
})
export type SuppliersList = z.infer<typeof suppliersListSchema>

export const createSupplierSchema = z
  .object({
    name: z.string().min(1),
    type: supplierTypeSchema,
    contactName: z.string().nullish(),
    contactEmail: z.string().email().nullish(),
    contactPhone: z.string().nullish(),
    notes: z.string().nullish(),
    deliveryMode: supplierDeliveryModeSchema.nullish(),
    referentId: z.string().uuid().nullish(),
    producerCategoryIds: z.array(z.string().uuid()).nullish(),
  })
  .meta({
    title: 'CreateSupplier',
    description: 'Create a supplier',
    examples: [{ name: 'Ferme des Prés', type: 'producer' }],
  })

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>

export const updateSupplierSchema = createSupplierSchema
  .partial()
  .extend({ version: z.number().int() })
  .meta({ title: 'UpdateSupplier', description: 'Update a supplier (send the loaded version)' })

export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>

export const enabledSupplierFilteringKeys = ['type', 'q'] as const
export const supplierFilteringSchema = createFilterQueryStringSchema(enabledSupplierFilteringKeys)
export type SupplierFiltering = z.infer<typeof supplierFilteringSchema>

export const supplierPaginationSchema = createPaginationQuerySchema()
export type SupplierPagination = z.infer<typeof supplierPaginationSchema>
