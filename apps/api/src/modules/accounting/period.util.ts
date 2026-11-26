import type { PeriodQuery } from './contracts/period.contract'

import {
  COOPERATIVE_TIME_ZONE,
  isCalendarDay,
  startOfParisDay,
  toParisDay,
} from '../../common/paris-time.util'

export { COOPERATIVE_TIME_ZONE, isCalendarDay, startOfParisDay, toParisDay }

export interface PeriodBounds {
  startsAt: Date
  endsBefore: Date
}

function nextDay(day: string): string {
  const next = new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000)
  return next.toISOString().slice(0, 10)
}

/**
 * Turns two calendar days, both included, into the two instants that bound the period in Paris:
 * a row belongs to it when `startsAt <= time < endsBefore`.
 */
export function readPeriod(query: PeriodQuery): PeriodBounds {
  if (query.from > query.to) throw new RangeError('The period starts after it ends')
  return { startsAt: startOfParisDay(query.from), endsBefore: startOfParisDay(nextDay(query.to)) }
}

/** What the services read: the two days as written, and the two instants that bound them. */
export interface Period extends PeriodBounds {
  from: string
  to: string
}

export function toPeriod(query: PeriodQuery): Period {
  return { from: query.from, to: query.to, ...readPeriod(query) }
}
