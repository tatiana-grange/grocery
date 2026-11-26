import { describe, expect, it } from 'vitest'
import { parisInstantAt } from './paris-time.util'

describe('parisInstantAt', () => {
  it('reads a winter hour as one hour before UTC', () => {
    expect(parisInstantAt('2026-12-02', 8).toISOString()).toBe('2026-12-02T07:00:00.000Z')
  })

  it('reads a summer hour as two hours before UTC', () => {
    expect(parisInstantAt('2026-07-14', 8).toISOString()).toBe('2026-07-14T06:00:00.000Z')
  })

  it('spring change, last Sunday of March 2026: 02:00 does not exist, the result is 03:00', () => {
    expect(parisInstantAt('2026-03-29', 2).toISOString()).toBe('2026-03-29T01:00:00.000Z')
  })

  it('autumn change, last Sunday of October 2026: 02:00 happens twice, the result is the first', () => {
    expect(parisInstantAt('2026-10-25', 2).toISOString()).toBe('2026-10-25T00:00:00.000Z')
  })

  it('the hours around the changes are unaffected', () => {
    expect(parisInstantAt('2026-03-29', 4).toISOString()).toBe('2026-03-29T02:00:00.000Z')
    expect(parisInstantAt('2026-10-25', 3).toISOString()).toBe('2026-10-25T02:00:00.000Z')
  })
})
