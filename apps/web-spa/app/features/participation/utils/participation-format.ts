/**
 * Dates and times of a slot, written in the browser's time zone. The API only speaks instants,
 * and the cooperative has one location, so the browser zone is the cooperative's zone.
 */

const DAY_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
}
const TIME_FORMAT: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }

export function formatSlotDay(startsAt: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, DAY_FORMAT).format(new Date(startsAt))
}

export function formatSlotTimes(startsAt: string, endsAt: string, locale: string): string {
  const time = new Intl.DateTimeFormat(locale, TIME_FORMAT)
  return `${time.format(new Date(startsAt))} – ${time.format(new Date(endsAt))}`
}

export function formatDeadline(deadline: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { ...DAY_FORMAT, ...TIME_FORMAT }).format(
    new Date(deadline),
  )
}
