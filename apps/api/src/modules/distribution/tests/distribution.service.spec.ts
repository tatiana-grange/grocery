import { describe, expect, it } from 'vitest'
import { lineReadiness } from '../distribution.util'

/**
 * The DB-backed side of `DistributionService` (the queries, the transaction, the member
 * lock) is exercised in `distribution.controller.e2e-spec.ts`. These unit tests pin the pure
 * rules — required by Principle IV for anything touching money, stock, or sale by weight.
 */
describe('lineReadiness', () => {
  it('treats an in-store line as always ready — it was bought from the shelf', () => {
    expect(lineReadiness('in_store', null)).toEqual({ isReady: true, notReadyReason: null })
  })

  it('stays ready for an in-store line even though it carries no fulfilment marker', () => {
    expect(lineReadiness('in_store', undefined).isReady).toBe(true)
  })

  it('reports a pre-order line as ready once lot 3 marked it fulfilled', () => {
    expect(lineReadiness('pre_order', new Date('2026-09-10T09:00:00Z'))).toEqual({
      isReady: true,
      notReadyReason: null,
    })
  })

  it('refuses a pre-order line whose goods have not arrived, and says why (FR-003)', () => {
    expect(lineReadiness('pre_order', null)).toEqual({
      isReady: false,
      notReadyReason: 'awaiting_reception',
    })
    expect(lineReadiness('pre_order', undefined).notReadyReason).toBe('awaiting_reception')
  })
})
