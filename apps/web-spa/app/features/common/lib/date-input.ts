function padNumber(value: number): string {
  return String(value).padStart(2, '0')
}

/** `yyyy-mm-dd`, in the browser's time zone: what a date input holds. */
export function toDateInput(instant: string | Date): string {
  const date = new Date(instant)
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`
}
