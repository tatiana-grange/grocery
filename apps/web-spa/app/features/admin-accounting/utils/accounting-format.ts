/** Whole cents to the text shown on screen: `-12.50 €`. Integer maths, so no float drift. */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const absolute = Math.abs(cents)
  const euros = Math.floor(absolute / 100)
  const rest = String(absolute % 100).padStart(2, '0')
  return `${sign}${euros}.${rest} €`
}

/** The text of an amount field (`12.5`, `12,50`) to whole cents. The form has checked it first. */
export function eurosToCents(text: string): number {
  return Math.round(Number(text.trim().replace(',', '.')) * 100)
}

/** A calendar day (`2026-03-01`) written the way the language writes dates. No time zone. */
export function formatDay(day: string, locale: string): string {
  const [year, month, date] = day.split('-').map(Number)
  return new Intl.DateTimeFormat(locale).format(new Date(year, month - 1, date))
}
