import { parisInstantAt, startOfParisDay, toParisDay } from '../../common/paris-time.util'

export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7
export type WeekParity = 'every' | 'even' | 'odd'
export type MonthWeek = 'first' | 'second' | 'third' | 'fourth' | 'last'

export type DistributionRule =
  | { frequency: 'weekly'; weekday: IsoWeekday; parity: WeekParity }
  | { frequency: 'monthly'; weekday: IsoWeekday; monthWeek: MonthWeek }

export interface OrderScheduleRule {
  distribution: DistributionRule
  sendingWeekday: IsoWeekday
  /** 0 to 23, whole hours. */
  sendingHour: number
}

export interface ScheduledDistribution {
  /** YYYY-MM-DD, a Paris calendar day. */
  distributionDay: string
  /** 00:00 Paris on that day: "the distribution has started". */
  startsAt: Date
  /** `sendingHour`:00 Paris on the sending day. */
  sendingAt: Date
}

/** The supplier columns the rule is read from. */
export interface SupplierScheduleColumns {
  scheduleFrequency?: 'weekly' | 'monthly' | null
  scheduleWeekParity?: WeekParity | null
  scheduleMonthWeek?: MonthWeek | null
  scheduleDistributionWeekday?: number | null
  scheduleSendingWeekday?: number | null
  scheduleSendingHour?: number | null
}

const DAY_MS = 86_400_000
/** How far the day-by-day walk goes before giving up. A rule always hits within 62 days. */
const SEARCH_LIMIT_DAYS = 400

function dayToUtc(day: string): Date {
  return new Date(Date.parse(`${day}T00:00:00Z`))
}

function addDays(day: string, days: number): string {
  return new Date(dayToUtc(day).getTime() + days * DAY_MS).toISOString().slice(0, 10)
}

/** ISO weekday of a calendar day: 1 Monday … 7 Sunday. */
function isoWeekday(day: string): IsoWeekday {
  const weekday = dayToUtc(day).getUTCDay()
  return (weekday === 0 ? 7 : weekday) as IsoWeekday
}

function daysInMonthOf(day: string): number {
  const date = dayToUtc(day)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
}

/** The ISO week number, the one printed on French calendars. */
export function isoWeekNumber(day: string): number {
  const date = dayToUtc(day)
  // The Thursday of the week decides the ISO year.
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1)
  return Math.ceil(((date.getTime() - yearStart) / DAY_MS + 1) / 7)
}

const MONTH_WEEK_START: Record<Exclude<MonthWeek, 'last'>, number> = {
  first: 1,
  second: 8,
  third: 15,
  fourth: 22,
}

export function isDistributionDay(rule: DistributionRule, day: string): boolean {
  if (isoWeekday(day) !== rule.weekday) return false
  if (rule.frequency === 'weekly') {
    if (rule.parity === 'every') return true
    const isEven = isoWeekNumber(day) % 2 === 0
    return rule.parity === 'even' ? isEven : !isEven
  }
  const dayOfMonth = dayToUtc(day).getUTCDate()
  if (rule.monthWeek === 'last') return dayOfMonth + 7 > daysInMonthOf(day)
  const start = MONTH_WEEK_START[rule.monthWeek]
  return dayOfMonth >= start && dayOfMonth < start + 7
}

/** The last `sendingWeekday` strictly before the distribution day (1 to 7 days before). */
export function sendingDayFor(sendingWeekday: IsoWeekday, distributionDay: string): string {
  const gap = ((isoWeekday(distributionDay) - sendingWeekday + 6) % 7) + 1
  return addDays(distributionDay, -gap)
}

function scheduled(rule: OrderScheduleRule, distributionDay: string): ScheduledDistribution {
  return {
    distributionDay,
    startsAt: startOfParisDay(distributionDay),
    sendingAt: parisInstantAt(
      sendingDayFor(rule.sendingWeekday, distributionDay),
      rule.sendingHour,
    ),
  }
}

/** Walks from `from` in steps of `step` days to the first day the rule hits. */
function walk(rule: OrderScheduleRule, from: string, step: 1 | -1): string | null {
  for (let offset = 0; offset < SEARCH_LIMIT_DAYS; offset += 1) {
    const day = addDays(from, step * offset)
    if (isDistributionDay(rule.distribution, day)) return day
  }
  return null
}

/** The first distribution whose day starts after `now`. */
export function nextDistribution(rule: OrderScheduleRule, now: Date): ScheduledDistribution {
  // Today has started already, so the walk begins tomorrow.
  const day = walk(rule, addDays(toParisDay(now), 1), 1)
  if (!day) throw new RangeError('The schedule rule never reaches a distribution day')
  return scheduled(rule, day)
}

/** The last distribution whose day has started at `now`, or null if none in the past year. */
export function latestStartedDistribution(
  rule: OrderScheduleRule,
  now: Date,
): ScheduledDistribution | null {
  const day = walk(rule, toParisDay(now), -1)
  return day ? scheduled(rule, day) : null
}

/** The distribution just before a given distribution day. */
export function previousDistribution(
  rule: OrderScheduleRule,
  distributionDay: string,
): ScheduledDistribution {
  const day = walk(rule, addDays(distributionDay, -1), -1)
  if (!day) throw new RangeError('The schedule rule has no earlier distribution day')
  return scheduled(rule, day)
}

/** Reads the rule off the supplier's columns; null when the schedule is incomplete. */
export function readOrderScheduleRule(columns: SupplierScheduleColumns): OrderScheduleRule | null {
  const weekday = columns.scheduleDistributionWeekday as IsoWeekday | null | undefined
  const sendingWeekday = columns.scheduleSendingWeekday as IsoWeekday | null | undefined
  const sendingHour = columns.scheduleSendingHour
  if (!weekday || !sendingWeekday || sendingHour == null) return null
  if (columns.scheduleFrequency === 'weekly' && columns.scheduleWeekParity) {
    return {
      distribution: { frequency: 'weekly', weekday, parity: columns.scheduleWeekParity },
      sendingWeekday,
      sendingHour,
    }
  }
  if (columns.scheduleFrequency === 'monthly' && columns.scheduleMonthWeek) {
    return {
      distribution: { frequency: 'monthly', weekday, monthWeek: columns.scheduleMonthWeek },
      sendingWeekday,
      sendingHour,
    }
  }
  return null
}

export interface DueDistributions {
  /** Started, never handled, sending moment after the schedule was switched on: alert. */
  missed: ScheduledDistribution | null
  /** Sending moment reached, not started yet, never handled: send now. */
  due: ScheduledDistribution | null
}

export function findDueDistributions(input: {
  rule: OrderScheduleRule
  now: Date
  /** `supplier.scheduleHandledDay`. */
  handledDay: string | null
  /** `supplier.scheduleActiveSince`. */
  activeSince: Date
}): DueDistributions {
  const { rule, now, handledDay, activeSince } = input
  const isOpen = (distribution: ScheduledDistribution): boolean =>
    distribution.sendingAt >= activeSince &&
    (handledDay === null || handledDay < distribution.distributionDay)

  const next = nextDistribution(rule, now)
  const latest = latestStartedDistribution(rule, now)
  return {
    due: now >= next.sendingAt && isOpen(next) ? next : null,
    missed: latest && isOpen(latest) ? latest : null,
  }
}
