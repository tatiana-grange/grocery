import { z } from 'zod'
import { isCalendarDay } from '../period.util'

/** A real calendar day written `YYYY-MM-DD`. Shared by the expense date and the period. */
export const calendarDaySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isCalendarDay, { message: 'Not a real calendar day' })
  .meta({
    title: 'CalendarDay',
    description: 'A calendar day written YYYY-MM-DD, with no time and no time zone.',
    examples: ['2026-03-31'],
  })

export const periodQuerySchema = z
  .object({ from: calendarDaySchema, to: calendarDaySchema })
  .refine((period) => period.from <= period.to, {
    message: 'The period must not start after it ends',
    path: ['from'],
  })
  .meta({
    title: 'PeriodQuery',
    description:
      'A period of calendar days in Europe/Paris, both days included. `from` must not be after `to`.',
  })
export type PeriodQuery = z.infer<typeof periodQuerySchema>
