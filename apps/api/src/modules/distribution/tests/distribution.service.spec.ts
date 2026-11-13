import { describe, expect, it } from 'vitest'
import {
  balanceCovers,
  findDuplicateLineId,
  handoverTotalCents,
  isOrderFullySettled,
  isSellableAtTable,
  lineReadiness,
  lineTotalCents,
} from '../distribution.util'

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

describe('lineTotalCents', () => {
  it('prices a whole-unit line at the snapshot price', () => {
    expect(lineTotalCents(3, 300)).toBe(900)
  })

  it('prices a by-weight line from the weight actually put on the scale (FR-012)', () => {
    // 0.6 kg of a product priced at 20 €/kg, ordered as an estimated 0.5 kg.
    expect(lineTotalCents(0.6, 2000)).toBe(1200)
  })

  it('contributes nothing for a line the member declined', () => {
    expect(lineTotalCents(0, 2000)).toBe(0)
  })

  it('rounds to whole cents, the way checkout priced the line in the first place', () => {
    // 0.333 kg at 19.99 €/kg = 665.667 cents.
    expect(lineTotalCents(0.333, 1999)).toBe(666)
  })
})

describe('handoverTotalCents', () => {
  const line = (handedQuantity: number, unitPriceAmountCents: number) => ({
    orderLineId: `line-${handedQuantity}-${unitPriceAmountCents}`,
    handedQuantity,
    unitPriceAmountCents,
    lineTotalAmountCents: lineTotalCents(handedQuantity, unitPriceAmountCents),
  })

  it('sums the adjusted lines, not what was ordered', () => {
    // 3 apples @ 3 € and 0.6 kg of cheese @ 20 €/kg = 21 €.
    expect(handoverTotalCents([line(3, 300), line(0.6, 2000)])).toBe(2100)
  })

  it('drops a declined line out of the total', () => {
    expect(handoverTotalCents([line(0, 300), line(0.5, 2000)])).toBe(1000)
  })

  it('is zero for a handover where everything was declined', () => {
    expect(handoverTotalCents([line(0, 300), line(0, 2000)])).toBe(0)
  })
})

describe('balanceCovers', () => {
  it('allows a handover the balance covers', () => {
    expect(balanceCovers(2100, 6000)).toBe(true)
  })

  it('allows spending the balance down to exactly zero — that is not an overdraft', () => {
    expect(balanceCovers(6000, 6000)).toBe(true)
  })

  it('refuses a handover one cent over the balance (FR-027, SC-010)', () => {
    expect(balanceCovers(6001, 6000)).toBe(false)
  })

  it('refuses anything at all on an empty account', () => {
    expect(balanceCovers(1, 0)).toBe(false)
    expect(balanceCovers(0, 0)).toBe(true)
  })
})

describe('isOrderFullySettled', () => {
  it('settles the order when this handover covers every line', () => {
    expect(isOrderFullySettled(['a', 'b'], new Set(), new Set(['a', 'b']))).toBe(true)
  })

  it('counts a line handed over at zero as settled — the member was offered it', () => {
    // The caller puts every line it priced into `settledNow`, zero included.
    expect(isOrderFullySettled(['a', 'b'], new Set(), new Set(['a', 'b']))).toBe(true)
  })

  it('leaves the order pending when a line was not touched', () => {
    expect(isOrderFullySettled(['a', 'b'], new Set(), new Set(['a']))).toBe(false)
  })

  it('counts a line settled by an earlier, un-reversed handover', () => {
    expect(isOrderFullySettled(['a', 'b'], new Set(['a']), new Set(['b']))).toBe(true)
  })
})

describe('findDuplicateLineId', () => {
  it('passes a body whose lines are all distinct', () => {
    expect(findDuplicateLineId(['a', 'b', 'c'])).toBeNull()
  })

  it('passes an empty body', () => {
    expect(findDuplicateLineId([])).toBeNull()
  })

  it('catches the same line sent twice — it would be charged twice', () => {
    expect(findDuplicateLineId(['a', 'b', 'a'])).toBe('a')
  })

  it('reports the first line that repeats', () => {
    expect(findDuplicateLineId(['a', 'b', 'b', 'a'])).toBe('b')
  })
})

describe('isSellableAtTable', () => {
  it('sells a product stocked for in-store buying', () => {
    expect(isSellableAtTable({ orderingMode: 'in_store' })).toBe(true)
  })

  it('sells a product that is both pre-orderable and stocked', () => {
    expect(isSellableAtTable({ orderingMode: 'both' })).toBe(true)
  })

  it('refuses a pre-order-only product — nothing is on the shelf today', () => {
    expect(isSellableAtTable({ orderingMode: 'pre_order' })).toBe(false)
  })

  it('refuses an archived product whatever its ordering mode', () => {
    expect(isSellableAtTable({ orderingMode: 'in_store', archivedAt: new Date() })).toBe(false)
    expect(isSellableAtTable({ orderingMode: 'both', archivedAt: new Date() })).toBe(false)
  })

  it('treats a null archivedAt as not archived', () => {
    expect(isSellableAtTable({ orderingMode: 'in_store', archivedAt: null })).toBe(true)
  })
})

/**
 * Reversal arithmetic. The stock side of this — the weighted average landing exactly back
 * where it was — is pinned in `inventory/tests/inventory.service.spec.ts`, because that is
 * where the formula lives. What is checked here is that the signs compose: a reversal is the
 * negation of what it undoes, so the two together net to nothing.
 */
describe('reversal arithmetic', () => {
  const line = (handedQuantity: number, unitPriceAmountCents: number) => ({
    orderLineId: `line-${handedQuantity}`,
    handedQuantity,
    unitPriceAmountCents,
    lineTotalAmountCents: lineTotalCents(handedQuantity, unitPriceAmountCents),
  })

  it('negates the total it undoes', () => {
    const original = [line(3, 300), line(0.6, 2000)]
    const reversal = original.map((entry) => ({
      ...entry,
      handedQuantity: -entry.handedQuantity,
      lineTotalAmountCents: -entry.lineTotalAmountCents,
    }))
    expect(handoverTotalCents(original)).toBe(2100)
    expect(handoverTotalCents(reversal)).toBe(-2100)
    expect(handoverTotalCents([...original, ...reversal])).toBe(0)
  })

  it('leaves a declined line at zero on both sides', () => {
    const original = [line(0, 300)]
    const reversal = original.map((entry) => ({ ...entry, lineTotalAmountCents: -0 }))
    expect(handoverTotalCents([...original, ...reversal])).toBe(0)
  })

  it('restores a balance the original handover had spent to exactly zero', () => {
    const balanceCents = 600
    const totalCents = handoverTotalCents([line(2, 300)])
    expect(balanceCovers(totalCents, balanceCents)).toBe(true)
    const afterHandover = balanceCents - totalCents
    expect(afterHandover).toBe(0)
    // The reversal credits the exact original charge, never a recomputed one.
    expect(afterHandover + totalCents).toBe(balanceCents)
  })
})
