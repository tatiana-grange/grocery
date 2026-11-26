import type { PeriodQuery } from './contracts/period.contract'

/** The time zone every period and every "day" of the accounting module is read in. */
export const COOPERATIVE_TIME_ZONE = 'Europe/Paris'

export interface PeriodBounds {
  startsAt: Date
  endsBefore: Date
}

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

const parisParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: COOPERATIVE_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

function formatDay({ year, month, day }: Record<string, string>): string {
  return `${year}-${month}-${day}`
}

function readParisParts(instant: Date): Record<string, string> {
  const parts: Record<string, string> = {}
  for (const part of parisParts.formatToParts(instant)) parts[part.type] = part.value
  return parts
}

/** True for a real calendar day written `YYYY-MM-DD`. `2026-02-30` is not one. */
export function isCalendarDay(value: string): boolean {
  const match = DAY_PATTERN.exec(value)
  if (!match) return false
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

export function toParisDay(instant: Date): string {
  return formatDay(readParisParts(instant))
}

/**
 * The instant of Paris midnight at the start of a calendar day. Paris changes its clock at 02:00
 * or 03:00, never at midnight, so every Paris midnight exists once and only once: the candidate
 * is the UTC midnight of the day shifted by one or two hours, and the right one reads 00:00 back.
 */
export function startOfParisDay(day: string): Date {
  if (!isCalendarDay(day)) throw new RangeError(`Not a calendar day: ${day}`)
  const utcMidnight = Date.parse(`${day}T00:00:00Z`)
  for (const offsetHours of [1, 2]) {
    const candidate = new Date(utcMidnight - offsetHours * 3_600_000)
    const parts = readParisParts(candidate)
    if (formatDay(parts) === day && parts.hour === '00') {
      return candidate
    }
  }
  throw new RangeError(`No Paris midnight found for ${day}`)
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
