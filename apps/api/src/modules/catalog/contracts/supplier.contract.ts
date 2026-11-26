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

export const SUPPLIER_DELIVERY_MODES = ['delivery', 'pickup'] as const
export const supplierDeliveryModeSchema = z.enum(SUPPLIER_DELIVERY_MODES).meta({
  title: 'SupplierDeliveryMode',
  description:
    'Whether the supplier delivers to the épicerie ("delivery") or someone picks the order up from them ("pickup")',
})
export type SupplierDeliveryMode = z.infer<typeof supplierDeliveryModeSchema>

export const SCHEDULE_FREQUENCIES = ['weekly', 'monthly'] as const
export const scheduleFrequencySchema = z.enum(SCHEDULE_FREQUENCIES).meta({
  title: 'ScheduleFrequency',
  description: 'Whether the supplier distributes every week or once a month',
})
export type ScheduleFrequency = z.infer<typeof scheduleFrequencySchema>

export const WEEK_PARITIES = ['every', 'even', 'odd'] as const
export const weekParitySchema = z.enum(WEEK_PARITIES).meta({
  title: 'WeekParity',
  description: 'Every week, or only the even or the odd ISO weeks (weekly distributions)',
})
export type WeekParity = z.infer<typeof weekParitySchema>

export const MONTH_WEEKS = ['first', 'second', 'third', 'fourth', 'last'] as const
export const monthWeekSchema = z.enum(MONTH_WEEKS).meta({
  title: 'MonthWeek',
  description: 'Which weekday of the month the distribution falls on (monthly distributions)',
})
export type MonthWeek = z.infer<typeof monthWeekSchema>

/** ISO weekday: 1 Monday … 7 Sunday. */
const isoWeekdaySchema = z.number().int().min(1).max(7)

/** An enabled schedule must say everything the rule needs; a disabled one may be partial. */
function requireCompleteWhenEnabled(
  schedule: {
    enabled: boolean
    frequency?: ScheduleFrequency | null
    weekParity?: WeekParity | null
    monthWeek?: MonthWeek | null
    distributionWeekday?: number | null
    sendingWeekday?: number | null
    sendingHour?: number | null
  },
  context: z.core.$RefinementCtx,
): void {
  if (!schedule.enabled) return
  const missing = (path: string) =>
    context.addIssue({ code: 'custom', path: [path], message: `${path} is required` })
  if (!schedule.frequency) missing('frequency')
  if (schedule.frequency === 'weekly' && !schedule.weekParity) missing('weekParity')
  if (schedule.frequency === 'monthly' && !schedule.monthWeek) missing('monthWeek')
  if (!schedule.distributionWeekday) missing('distributionWeekday')
  if (!schedule.sendingWeekday) missing('sendingWeekday')
  if (schedule.sendingHour == null) missing('sendingHour')
}

export const supplierOrderScheduleSchema = z
  .object({
    enabled: z.boolean(),
    frequency: scheduleFrequencySchema.nullish(),
    weekParity: weekParitySchema.nullish(),
    monthWeek: monthWeekSchema.nullish(),
    distributionWeekday: isoWeekdaySchema.nullish(),
    sendingWeekday: isoWeekdaySchema.nullish(),
    sendingHour: z.number().int().min(0).max(23).nullish(),
  })
  .superRefine(requireCompleteWhenEnabled)
  .meta({
    title: 'SupplierOrderSchedule',
    description:
      'When the app sends this supplier its order by itself: the distribution rhythm, the weekday ' +
      'the order leaves (the last such weekday before the distribution) and the hour (Paris time)',
  })
export type SupplierOrderSchedule = z.infer<typeof supplierOrderScheduleSchema>

export const supplierNextOrderSchema = z
  .object({
    distributionDay: z.string().meta({ description: 'YYYY-MM-DD, a Paris calendar day' }),
    sendingAt: z.date(),
  })
  .meta({
    title: 'SupplierNextOrder',
    description: 'The next distribution of a supplier and the moment its order is sent',
  })
export type SupplierNextOrder = z.infer<typeof supplierNextOrderSchema>

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
    orderSchedule: supplierOrderScheduleSchema,
    nextOrder: supplierNextOrderSchema.nullish(),
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
    orderSchedule: supplierOrderScheduleSchema.nullish(),
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
