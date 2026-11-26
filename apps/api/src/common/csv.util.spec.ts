import { describe, expect, it } from 'vitest'
import { formatEuros, toCsv, toCsvLines } from './csv.util'

function oneCell(cell: string | number | { cents: number } | null): string {
  const csv = toCsv({ header: ['h'], rows: [[cell]] })
  return csv.split('\r\n')[1]
}

describe('toCsv', () => {
  it('guards a text value that starts with = so a spreadsheet does not run it', () => {
    expect(oneCell('=SUM(A1)')).toBe("'=SUM(A1)")
  })

  it.each([
    ['+', '+1'],
    ['-', '-10 % discount'],
    ['@', '@cmd'],
    ['a tab', '\tx'],
  ])('guards a text value that starts with %s', (_name, value) => {
    expect(oneCell(value)).toBe(`'${value}`)
  })

  it('guards a text value that starts with a carriage return, and quotes it', () => {
    expect(oneCell('\rx')).toBe(`"'\rx"`)
  })

  it('does not guard an amount, so -12.50 stays a number', () => {
    expect(oneCell({ cents: -1250 })).toBe('-12.50')
  })

  it('does not guard a negative number', () => {
    expect(oneCell(-3)).toBe('-3')
  })

  it('quotes a value with a comma', () => {
    expect(oneCell('a,b')).toBe('"a,b"')
  })

  it('doubles a quote inside a value and quotes it', () => {
    expect(oneCell('say "hi"')).toBe('"say ""hi"""')
  })

  it('quotes a value with a line break', () => {
    expect(oneCell('a\nb')).toBe('"a\nb"')
  })

  it('writes null as an empty cell', () => {
    expect(toCsv({ header: ['a', 'b'], rows: [['x', null]] })).toBe('a,b\r\nx,\r\n')
  })

  it('writes the header first and ends every line with CRLF', () => {
    expect(
      toCsv({
        header: ['a', 'b'],
        rows: [
          ['1', 2],
          ['3', 4],
        ],
      }),
    ).toBe('a,b\r\n1,2\r\n3,4\r\n')
  })

  it('writes only the header when there is no row', () => {
    expect(toCsv({ header: ['a', 'b'], rows: [] })).toBe('a,b\r\n')
  })

  it('keeps accents as they are', () => {
    expect(oneCell('Éléonore Müller')).toBe('Éléonore Müller')
  })

  it('writes a number with String()', () => {
    expect(oneCell(1.5)).toBe('1.5')
  })
})

describe('toCsvLines', () => {
  it('writes no line end and quotes every text cell on request', () => {
    expect(toCsvLines({ header: ['a', 'b'], rows: [['x', 2]] }, { alwaysQuote: true })).toEqual([
      '"a","b"',
      '"x",2',
    ])
  })
})

describe('formatEuros', () => {
  it.each([
    [0, '0.00'],
    [5, '0.05'],
    [-5, '-0.05'],
    [100, '1.00'],
    [123456, '1234.56'],
    [1234, '12.34'],
    [-1250, '-12.50'],
  ])('writes %i cents as %s', (cents, expected) => {
    expect(formatEuros(cents)).toBe(expected)
  })
})
