import { describe, expect, it } from 'vitest'
import {
  findDueDistributions,
  isDistributionDay,
  isoWeekNumber,
  latestStartedDistribution,
  nextDistribution,
  previousDistribution,
  readOrderScheduleRule,
  sendingDayFor,
} from '../order-schedule.util'
import type { MonthWeek, OrderScheduleRule } from '../order-schedule.util'

const FLOUR: OrderScheduleRule = {
  distribution: { frequency: 'monthly', weekday: 5, monthWeek: 'first' },
  sendingWeekday: 3,
  sendingHour: 8,
}

function weeklyRule(parity: 'every' | 'even' | 'odd'): OrderScheduleRule {
  return {
    distribution: { frequency: 'weekly', weekday: 5, parity },
    sendingWeekday: 3,
    sendingHour: 8,
  }
}

function daysOfMonth(year: number, month: number): string[] {
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return Array.from(
    { length: count },
    (_, index) => `${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`,
  )
}

describe('nextDistribution', () => {
  it('flour: from Thursday 2026-11-26 the next distribution is Friday 2026-12-04, sent Wednesday 2026-12-02 at 08:00 Paris', () => {
    const next = nextDistribution(FLOUR, new Date('2026-11-26T10:00:00Z'))

    expect(next.distributionDay).toBe('2026-12-04')
    expect(next.sendingAt.toISOString()).toBe('2026-12-02T07:00:00.000Z')
    expect(next.startsAt.toISOString()).toBe('2026-12-03T23:00:00.000Z')
  })

  it('a monthly distribution whose first Friday is the 1st is sent the Wednesday of the month before', () => {
    const next = nextDistribution(FLOUR, new Date('2026-12-20T10:00:00Z'))

    expect(next.distributionDay).toBe('2027-01-01')
    expect(next.sendingAt.toISOString()).toBe('2026-12-30T07:00:00.000Z')
  })

  it('skips today: a distribution that has started is not the next one', () => {
    const next = nextDistribution(weeklyRule('every'), new Date('2026-12-04T09:00:00Z'))

    expect(next.distributionDay).toBe('2026-12-11')
  })

  it('weekly every week gives each Friday', () => {
    const first = nextDistribution(weeklyRule('every'), new Date('2026-11-26T10:00:00Z'))
    const second = nextDistribution(weeklyRule('every'), first.startsAt)

    expect([first.distributionDay, second.distributionDay]).toEqual(['2026-11-27', '2026-12-04'])
  })

  it('even weeks give the Fridays of even ISO weeks', () => {
    // 2026-12-04 is in week 49 (odd), 2026-12-11 in week 50 (even).
    const next = nextDistribution(weeklyRule('even'), new Date('2026-11-30T10:00:00Z'))

    expect(next.distributionDay).toBe('2026-12-11')
  })

  it('odd weeks give the Fridays of odd ISO weeks', () => {
    const next = nextDistribution(weeklyRule('odd'), new Date('2026-12-05T10:00:00Z'))

    expect(next.distributionDay).toBe('2026-12-18')
  })

  it('a sending weekday equal to the distribution weekday is sent a week earlier', () => {
    const rule: OrderScheduleRule = { ...FLOUR, sendingWeekday: 5 }

    const next = nextDistribution(rule, new Date('2026-11-26T10:00:00Z'))

    expect(next.distributionDay).toBe('2026-12-04')
    expect(next.sendingAt.toISOString()).toBe('2026-11-27T07:00:00.000Z')
  })

  it('a sending at 02:00 on the spring change day leaves at 03:00 Paris', () => {
    const rule: OrderScheduleRule = {
      distribution: { frequency: 'weekly', weekday: 1, parity: 'every' },
      sendingWeekday: 7,
      sendingHour: 2,
    }

    const next = nextDistribution(rule, new Date('2026-03-27T10:00:00Z'))

    expect(next.distributionDay).toBe('2026-03-30')
    expect(next.sendingAt.toISOString()).toBe('2026-03-29T01:00:00.000Z')
  })

  it('a sending at 02:00 on the autumn change day leaves at the first 02:00 Paris', () => {
    const rule: OrderScheduleRule = {
      distribution: { frequency: 'weekly', weekday: 1, parity: 'every' },
      sendingWeekday: 7,
      sendingHour: 2,
    }

    const next = nextDistribution(rule, new Date('2026-10-23T10:00:00Z'))

    expect(next.distributionDay).toBe('2026-10-26')
    expect(next.sendingAt.toISOString()).toBe('2026-10-25T00:00:00.000Z')
  })
})

describe('isoWeekNumber and the week 53 of 2026', () => {
  it('reads the ISO week numbers of the year change', () => {
    expect(isoWeekNumber('2026-12-25')).toBe(52)
    expect(isoWeekNumber('2027-01-01')).toBe(53)
    expect(isoWeekNumber('2027-01-08')).toBe(1)
  })

  it('odd weeks: week 53 of 2026 is followed by week 1 of 2027, so two odd Fridays come in a row', () => {
    const rule = weeklyRule('odd')

    expect(isDistributionDay(rule.distribution, '2027-01-01')).toBe(true)
    expect(isDistributionDay(rule.distribution, '2027-01-08')).toBe(true)
    expect(isDistributionDay(rule.distribution, '2027-01-15')).toBe(false)
  })
})

describe('isDistributionDay, monthly over the twelve months of 2027', () => {
  const FRIDAYS: Record<number, string[]> = {
    1: ['2027-01-01', '2027-01-08', '2027-01-15', '2027-01-22', '2027-01-29'],
    2: ['2027-02-05', '2027-02-12', '2027-02-19', '2027-02-26'],
    3: ['2027-03-05', '2027-03-12', '2027-03-19', '2027-03-26'],
    4: ['2027-04-02', '2027-04-09', '2027-04-16', '2027-04-23', '2027-04-30'],
    5: ['2027-05-07', '2027-05-14', '2027-05-21', '2027-05-28'],
    6: ['2027-06-04', '2027-06-11', '2027-06-18', '2027-06-25'],
    7: ['2027-07-02', '2027-07-09', '2027-07-16', '2027-07-23', '2027-07-30'],
    8: ['2027-08-06', '2027-08-13', '2027-08-20', '2027-08-27'],
    9: ['2027-09-03', '2027-09-10', '2027-09-17', '2027-09-24'],
    10: ['2027-10-01', '2027-10-08', '2027-10-15', '2027-10-22', '2027-10-29'],
    11: ['2027-11-05', '2027-11-12', '2027-11-19', '2027-11-26'],
    12: ['2027-12-03', '2027-12-10', '2027-12-17', '2027-12-24', '2027-12-31'],
  }
  const WEEKS: Array<[MonthWeek, (fridays: string[]) => string]> = [
    ['first', (fridays) => fridays[0]],
    ['second', (fridays) => fridays[1]],
    ['third', (fridays) => fridays[2]],
    ['fourth', (fridays) => fridays[3]],
    ['last', (fridays) => fridays[fridays.length - 1]],
  ]

  it.each(Object.keys(FRIDAYS).map(Number))('month %i', (month) => {
    for (const [monthWeek, expected] of WEEKS) {
      const found = daysOfMonth(2027, month).filter((day) =>
        isDistributionDay({ frequency: 'monthly', weekday: 5, monthWeek }, day),
      )

      expect(found, `${monthWeek} Friday of month ${month}`).toEqual([expected(FRIDAYS[month])])
    }
  })
})

describe('sendingDayFor', () => {
  it('is the last such weekday strictly before the distribution day', () => {
    expect(sendingDayFor(3, '2026-12-04')).toBe('2026-12-02')
    expect(sendingDayFor(5, '2026-12-04')).toBe('2026-11-27')
    expect(sendingDayFor(4, '2026-12-04')).toBe('2026-12-03')
  })
})

describe('latestStartedDistribution and previousDistribution', () => {
  it('latest started: the distribution day has started at 00:00 Paris', () => {
    expect(
      latestStartedDistribution(FLOUR, new Date('2026-12-03T22:59:00Z'))?.distributionDay,
    ).toBe('2026-11-06')
    expect(
      latestStartedDistribution(FLOUR, new Date('2026-12-03T23:00:00Z'))?.distributionDay,
    ).toBe('2026-12-04')
  })

  it('previous distribution of 2026-12-04 is 2026-11-06', () => {
    expect(previousDistribution(FLOUR, '2026-12-04').distributionDay).toBe('2026-11-06')
  })
})

describe('readOrderScheduleRule', () => {
  const base = {
    scheduleFrequency: 'monthly' as const,
    scheduleWeekParity: null,
    scheduleMonthWeek: 'first' as const,
    scheduleDistributionWeekday: 5,
    scheduleSendingWeekday: 3,
    scheduleSendingHour: 8,
  }

  it('reads a monthly rule', () => {
    expect(readOrderScheduleRule(base)).toEqual(FLOUR)
  })

  it('reads a weekly rule', () => {
    expect(
      readOrderScheduleRule({
        ...base,
        scheduleFrequency: 'weekly',
        scheduleWeekParity: 'even',
        scheduleMonthWeek: null,
      }),
    ).toEqual(weeklyRule('even'))
  })

  it('is null when the schedule is incomplete', () => {
    expect(readOrderScheduleRule({ ...base, scheduleSendingHour: null })).toBeNull()
    expect(readOrderScheduleRule({ ...base, scheduleMonthWeek: null })).toBeNull()
    expect(readOrderScheduleRule({ ...base, scheduleFrequency: null })).toBeNull()
  })
})

describe('findDueDistributions', () => {
  // Flour: distribution Friday 2026-12-04, sending Wednesday 2026-12-02 at 08:00 Paris (07:00Z).
  const activeSince = new Date('2026-11-10T00:00:00Z')
  const base = { rule: FLOUR, handledDay: null, activeSince }

  it('before the sending moment: nothing is due', () => {
    const result = findDueDistributions({ ...base, now: new Date('2026-12-02T06:59:00Z') })

    expect(result).toEqual({ missed: null, due: null })
  })

  it('at the sending moment: the distribution is due', () => {
    const result = findDueDistributions({ ...base, now: new Date('2026-12-02T07:00:00Z') })

    expect(result.due?.distributionDay).toBe('2026-12-04')
    expect(result.missed).toBeNull()
  })

  it('once handled: nothing is due', () => {
    const result = findDueDistributions({
      ...base,
      handledDay: '2026-12-04',
      now: new Date('2026-12-02T07:05:00Z'),
    })

    expect(result).toEqual({ missed: null, due: null })
  })

  it('late but before the distribution starts: still due', () => {
    const result = findDueDistributions({ ...base, now: new Date('2026-12-03T22:00:00Z') })

    expect(result.due?.distributionDay).toBe('2026-12-04')
  })

  it('after the distribution started and never handled: missed, not due', () => {
    const result = findDueDistributions({ ...base, now: new Date('2026-12-04T10:00:00Z') })

    expect(result.due).toBeNull()
    expect(result.missed?.distributionDay).toBe('2026-12-04')
  })

  it('a sending moment before the schedule was switched on is ignored, due or missed', () => {
    const late = new Date('2026-12-02T12:00:00Z')

    expect(
      findDueDistributions({ ...base, activeSince: late, now: new Date('2026-12-03T10:00:00Z') }),
    ).toEqual({ missed: null, due: null })
    expect(
      findDueDistributions({ ...base, activeSince: late, now: new Date('2026-12-04T10:00:00Z') }),
    ).toEqual({ missed: null, due: null })
  })
})
