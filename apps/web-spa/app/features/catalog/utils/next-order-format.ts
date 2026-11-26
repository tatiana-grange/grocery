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
