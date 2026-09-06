import { describe, expect, it } from 'vitest'
import { discrepancyFor, sumQuantities } from '../purchasing.util'

/**
 * The DB-backed behaviour of `PurchasingService` (the aggregation query, already-linked
 * exclusion, skip-and-report, the `409` when nothing is pending, and every status
 * transition) is exercised in `purchasing.controller.e2e-spec.ts`. These unit tests pin the
 * pure money/stock/weight logic that Principle IV requires dedicated coverage for.
 */
describe('sumQuantities (aggregation)', () => {
  it('sums a product’s quantity across several members’ pre-order lines', () => {
    expect(sumQuantities(['2', '3', '1'])).toBe('6')
  })

  it('keeps 3-decimal precision for by-weight quantities without float drift', () => {
    expect(sumQuantities(['0.1', '0.2'])).toBe('0.3')
    expect(sumQuantities(['1.333', '2.667'])).toBe('4')
  })

  it('accepts numbers as well as decimal strings', () => {
    expect(sumQuantities([1.5, '2.5'])).toBe('4')
  })
})

describe('discrepancyFor', () => {
  it('flags any non-zero difference for a unit-sold line', () => {
    expect(discrepancyFor('unit', 10, 10, null)).toBe('none')
    expect(discrepancyFor('unit', 10, 8, null)).toBe('short')
    expect(discrepancyFor('unit', 10, 12, null)).toBe('over')
  })

  it('flags a zero-received line as fully short', () => {
    expect(discrepancyFor('unit', 5, 0, null)).toBe('short')
  })

  it('does not flag a by-weight line within its tolerance band', () => {
    // 10 kg ordered, 5% tolerance → anything in [9.5, 10.5] is fine
    expect(discrepancyFor('weight', 10, 9.6, 5)).toBe('none')
    expect(discrepancyFor('weight', 10, 10.5, 5)).toBe('none')
  })

  it('flags a by-weight line outside its tolerance band', () => {
    expect(discrepancyFor('weight', 10, 9.2, 5)).toBe('short')
    expect(discrepancyFor('weight', 10, 11, 5)).toBe('over')
  })

  it('treats a by-weight line with no tolerance set like a unit line', () => {
    expect(discrepancyFor('weight', 10, 9.9, null)).toBe('short')
  })
})
