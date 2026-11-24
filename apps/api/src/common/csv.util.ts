/** An amount in cents, written as euros with two decimals. Never guarded: it is a number. */
export interface CsvAmount {
  cents: number
}

/** A `string` is text (guarded against formulas), a `number` is written as is, `null` is empty. */
export type CsvCell = string | number | CsvAmount | null

const LINE_END = '\r\n'
const FORMULA_STARTS = ['=', '+', '-', '@', '\t', '\r']

/** `1234` gives `12.34`, `-5` gives `-0.05`. Whole-cent integer maths, no float formatting. */
export function formatEuros(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const absolute = Math.abs(Math.round(cents))
  const euros = Math.floor(absolute / 100)
  const rest = String(absolute % 100).padStart(2, '0')
  return `${sign}${euros}.${rest}`
}

function quoteIfNeeded(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`
  return value
}

function writeCell(cell: CsvCell): string {
  if (cell === null) return ''
  if (typeof cell === 'number') return String(cell)
  if (typeof cell === 'object') return formatEuros(cell.cents)
  const guarded = FORMULA_STARTS.some((start) => cell.startsWith(start)) ? `'${cell}` : cell
  return quoteIfNeeded(guarded)
}

/** Header first, then one line per row, each ended by CRLF (RFC 4180). */
export function toCsv(input: { header: string[]; rows: CsvCell[][] }): string {
  const lines = [input.header, ...input.rows].map((row) =>
    row.map((cell) => writeCell(cell)).join(','),
  )
  return lines.map((line) => line + LINE_END).join('')
}
