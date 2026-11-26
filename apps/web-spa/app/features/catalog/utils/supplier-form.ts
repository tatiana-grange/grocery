import type {
  CatalogSupplier as Supplier,
  SupplierOrderSchedule,
} from '@grocery/openapi-generator/client/types.gen'
import type { TFunction } from 'i18next'
import { z } from 'zod'

const SUPPLIER_TYPES = ['producer', 'wholesaler'] as const

/** The supplier form holds plain text, as the inputs do. */
export interface SupplierFormValues {
  name: string
  type: (typeof SUPPLIER_TYPES)[number]
  contactEmail: string
}

export function createSupplierFormSchema(
  t: TFunction,
): z.ZodType<SupplierFormValues, SupplierFormValues> {
  return z.object({
    name: z.string().trim().min(1, t('catalog.suppliers.errors.name')),
    type: z.enum(SUPPLIER_TYPES),
    contactEmail: z
      .string()
      .trim()
      .refine(
        (value) => value === '' || z.string().email().safeParse(value).success,
        t('catalog.suppliers.errors.contactEmail'),
      ),
  })
}

export function supplierFormDefaults(supplier?: Supplier): SupplierFormValues {
  return {
    name: supplier?.name ?? '',
    type: supplier?.type ?? 'producer',
    contactEmail: supplier?.contactEmail ?? '',
  }
}

// The order schedule ---------------------------------------------------------------------------

export const SCHEDULE_FIELDS = [
  'frequency',
  'weekParity',
  'monthWeek',
  'distributionWeekday',
  'sendingWeekday',
  'sendingHour',
] as const
export type ScheduleField = (typeof SCHEDULE_FIELDS)[number]

export const WEEK_PARITIES = ['every', 'even', 'odd'] as const
export const MONTH_WEEKS = ['first', 'second', 'third', 'fourth', 'last'] as const
export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const
export const SENDING_HOURS = Array.from({ length: 24 }, (_, hour) => hour)

/** Every select holds text; an empty text means "not chosen yet". */
export interface ScheduleFormValues {
  enabled: boolean
  frequency: '' | 'weekly' | 'monthly'
  weekParity: '' | (typeof WEEK_PARITIES)[number]
  monthWeek: '' | (typeof MONTH_WEEKS)[number]
  distributionWeekday: string
  sendingWeekday: string
  sendingHour: string
}

/** Mirrors the API's `requireCompleteWhenEnabled`: an enabled schedule must be complete. */
export const scheduleFormSchema: z.ZodType<ScheduleFormValues, ScheduleFormValues> = z
  .object({
    enabled: z.boolean(),
    frequency: z.enum(['', 'weekly', 'monthly']),
    weekParity: z.enum(['', ...WEEK_PARITIES]),
    monthWeek: z.enum(['', ...MONTH_WEEKS]),
    distributionWeekday: z.string(),
    sendingWeekday: z.string(),
    sendingHour: z.string(),
  })
  .superRefine((values, context) => {
    if (!values.enabled) return
    const missing = (field: ScheduleField) =>
      context.addIssue({ code: 'custom', path: [field], message: field })
    if (!values.frequency) missing('frequency')
    if (values.frequency === 'weekly' && !values.weekParity) missing('weekParity')
    if (values.frequency === 'monthly' && !values.monthWeek) missing('monthWeek')
    if (!values.distributionWeekday) missing('distributionWeekday')
    if (!values.sendingWeekday) missing('sendingWeekday')
    if (!values.sendingHour) missing('sendingHour')
  })

/** The fields an enabled schedule still lacks, in screen order. */
export function missingScheduleFields(values: ScheduleFormValues): ScheduleField[] {
  const result = scheduleFormSchema.safeParse(values)
  if (result.success) return []
  const named = new Set(result.error.issues.map((issue) => issue.path[0]))
  return SCHEDULE_FIELDS.filter((field) => named.has(field))
}

export function scheduleFormDefaults(schedule: SupplierOrderSchedule): ScheduleFormValues {
  return {
    enabled: schedule.enabled,
    frequency: schedule.frequency ?? '',
    weekParity: schedule.weekParity ?? '',
    monthWeek: schedule.monthWeek ?? '',
    distributionWeekday: schedule.distributionWeekday ? String(schedule.distributionWeekday) : '',
    sendingWeekday: schedule.sendingWeekday ? String(schedule.sendingWeekday) : '',
    sendingHour: schedule.sendingHour == null ? '' : String(schedule.sendingHour),
  }
}

/** What the API takes. The field that does not apply to the frequency is sent empty. */
export function toSchedulePayload(values: ScheduleFormValues): SupplierOrderSchedule {
  const number = (text: string) => (text === '' ? null : Number(text))
  return {
    enabled: values.enabled,
    frequency: values.frequency || null,
    weekParity: values.frequency === 'weekly' ? values.weekParity || null : null,
    monthWeek: values.frequency === 'monthly' ? values.monthWeek || null : null,
    distributionWeekday: number(
      values.distributionWeekday,
    ) as SupplierOrderSchedule['distributionWeekday'],
    sendingWeekday: number(values.sendingWeekday) as SupplierOrderSchedule['sendingWeekday'],
    sendingHour: number(values.sendingHour),
  }
}

// Dates ----------------------------------------------------------------------------------------

const PARIS = 'Europe/Paris'

/** A short weekday name such as "ven." for an ISO weekday, 1 Monday … 7 Sunday. */
export function weekdayName(
  weekday: number,
  locale: string,
  style: 'long' | 'short' = 'long',
): string {
  // 2026-11-23 is a Monday.
  const date = new Date(Date.UTC(2026, 10, 22 + weekday))
  return new Intl.DateTimeFormat(locale, { weekday: style, timeZone: 'UTC' }).format(date)
}

/** "ven. 4 déc." for a Paris calendar day written `YYYY-MM-DD`. */
export function formatDistributionDay(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00Z`))
}

/** "mer. 2 déc." and the whole Paris hour (8) of the sending moment. */
export function formatSendingMoment(
  sendingAt: Date | string,
  locale: string,
): { day: string; hour: number } {
  const instant = new Date(sendingAt)
  const day = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: PARIS,
  }).format(instant)
  const hourPart = new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    hourCycle: 'h23',
    timeZone: PARIS,
  })
    .formatToParts(instant)
    .find((part) => part.type === 'hour')
  return { day, hour: Number(hourPart?.value ?? 0) }
}
