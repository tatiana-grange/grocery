import { describe, expect, it } from 'vitest'
import { isCalendarDay, readPeriod, startOfParisDay, toParisDay } from '../period.util'

describe('readPeriod', () => {
  it('reads a summer day as starting at 22:00 UTC the day before', () => {
    const { startsAt, endsBefore } = readPeriod({ from: '2026-07-14', to: '2026-07-14' })

    expect(startsAt.toISOString()).toBe('2026-07-13T22:00:00.000Z')
    expect(endsBefore.toISOString()).toBe('2026-07-14T22:00:00.000Z')
  })

  it.each([
    {
      name: 'a winter day starts at 23:00 UTC the day before',
      from: '2026-01-15',
      to: '2026-01-15',
      startsAt: '2026-01-14T23:00:00.000Z',
      endsBefore: '2026-01-15T23:00:00.000Z',
    },
    {
      name: 'the spring change day 2026-03-29 lasts 23 hours',
      from: '2026-03-29',
      to: '2026-03-29',
      startsAt: '2026-03-28T23:00:00.000Z',
      endsBefore: '2026-03-29T22:00:00.000Z',
    },
    {
      name: 'the autumn change day 2026-10-25 lasts 25 hours',
      from: '2026-10-25',
      to: '2026-10-25',
      startsAt: '2026-10-24T22:00:00.000Z',
      endsBefore: '2026-10-25T23:00:00.000Z',
    },
    {
      name: 'a whole year runs from winter midnight to winter midnight',
      from: '2026-01-01',
      to: '2026-12-31',
      startsAt: '2025-12-31T23:00:00.000Z',
      endsBefore: '2026-12-31T23:00:00.000Z',
    },
    {
      name: 'a period across the new year',
      from: '2026-12-30',
      to: '2027-01-02',
      startsAt: '2026-12-29T23:00:00.000Z',
      endsBefore: '2027-01-02T23:00:00.000Z',
    },
    {
      name: 'both days are included, across the spring change',
      from: '2026-03-01',
      to: '2026-03-31',
      startsAt: '2026-02-28T23:00:00.000Z',
      endsBefore: '2026-03-31T22:00:00.000Z',
    },
  ])('$name', ({ from, to, startsAt, endsBefore }) => {
    const bounds = readPeriod({ from, to })

    expect(bounds.startsAt.toISOString()).toBe(startsAt)
    expect(bounds.endsBefore.toISOString()).toBe(endsBefore)
  })

  it('throws when the start is after the end', () => {
    expect(() => readPeriod({ from: '2026-05-02', to: '2026-05-01' })).toThrow(RangeError)
  })
})

describe('startOfParisDay', () => {
  it('gives Paris midnight of the day as an instant', () => {
    expect(startOfParisDay('2026-07-14').toISOString()).toBe('2026-07-13T22:00:00.000Z')
  })
})

describe('toParisDay', () => {
  it('moves 2026-12-31T23:30Z to the next Paris day', () => {
    expect(toParisDay(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01')
  })

  it('keeps 2026-07-14T21:59:59Z on its own Paris day', () => {
    expect(toParisDay(new Date('2026-07-14T21:59:59Z'))).toBe('2026-07-14')
  })
})

describe('isCalendarDay', () => {
  it.each(['2026-01-01', '2028-02-29', '2026-12-31'])('accepts %s', (value) => {
    expect(isCalendarDay(value)).toBe(true)
  })

  it.each(['2026-02-30', '2026-13-01', '26-01-01', '2026-1-01', '', '2026-02-29', 'abcd-ef-gh'])(
    'refuses %s',
    (value) => {
      expect(isCalendarDay(value)).toBe(false)
    },
  )
})
