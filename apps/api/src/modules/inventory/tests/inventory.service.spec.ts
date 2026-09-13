import { describe, expect, it } from 'vitest'
import { buildStockLevel, emptyStockLevel } from '../inventory.util'

/**
 * The DB-backed side of `InventoryService` (the grouped sums, the queries, pagination) is
 * exercised in `inventory.controller.e2e-spec.ts`. These unit tests pin the money/stock
 * formula itself — required by Principle IV for stock and cost-price logic.
 *
 * The totals are what the grouped query hands back: `SUM(quantity)` and
 * `SUM(quantity * unitCostAmountCents)`.
 */
describe('buildStockLevel', () => {
  it('reports the summed quantity on hand', () => {
    // 3 + 2.5 units, all received at 1.00 €.
    const level = buildStockLevel({ quantity: 5.5, costNumeratorCents: 550 })
    expect(level.quantityOnHand).toBe(5.5)
  })

  it('takes the quantity-weighted average cost across movements at different unit costs', () => {
    // 10 @ 1.00 € and 30 @ 1.40 € → (10*100 + 30*140) / 40 = 130 cents = 1.30 €
    const level = buildStockLevel({ quantity: 40, costNumeratorCents: 5200 })
    expect(level.quantityOnHand).toBe(40)
    expect(level.costPriceEur).toBe(1.3)
  })

  it('reports 0 / null for a product with no movements (FR-020)', () => {
    const level = buildStockLevel({ quantity: 0, costNumeratorCents: 0 })
    expect(level).toEqual(emptyStockLevel())
    expect(level).toEqual({ quantityOnHand: 0, costPriceEur: null })
  })

  it('reports no cost price when the movements net to a zero quantity', () => {
    expect(buildStockLevel({ quantity: 0, costNumeratorCents: 400 }).costPriceEur).toBeNull()
  })

  it('rounds the quantity to 3 decimals, so a numeric sum cannot show float noise', () => {
    const level = buildStockLevel({ quantity: 0.1 + 0.2, costNumeratorCents: 60 })
    expect(level.quantityOnHand).toBe(0.3)
  })
})

/**
 * Lot 4 makes `quantity` signed. These pin the property the whole outbound design rests on
 * (research.md §5): issuing stock at the product's *current* weighted average leaves that
 * average unchanged, which is why one formula keeps serving both directions.
 */
describe('buildStockLevel with outbound movements', () => {
  /** Mirrors what the grouped query would return after each movement. */
  function totalsAfter(movements: { quantity: number; unitCostCents: number }[]) {
    return {
      quantity: movements.reduce((sum, m) => sum + m.quantity, 0),
      costNumeratorCents: movements.reduce((sum, m) => sum + m.quantity * m.unitCostCents, 0),
    }
  }

  it('leaves the weighted average untouched when stock is issued at that average', () => {
    // Received 10 @ 1.00 € and 30 @ 1.40 € → average 1.30 €.
    const received = [
      { quantity: 10, unitCostCents: 100 },
      { quantity: 30, unitCostCents: 140 },
    ]
    const before = buildStockLevel(totalsAfter(received))
    expect(before.costPriceEur).toBe(1.3)

    // Hand over 12 of them, valued at the current average of 130 cents.
    const after = buildStockLevel(totalsAfter([...received, { quantity: -12, unitCostCents: 130 }]))
    expect(after.quantityOnHand).toBe(28)
    expect(after.costPriceEur).toBe(1.3)
  })

  it('still holds after a second issue at the unchanged average', () => {
    const movements = [
      { quantity: 10, unitCostCents: 100 },
      { quantity: 30, unitCostCents: 140 },
      { quantity: -12, unitCostCents: 130 },
      { quantity: -8, unitCostCents: 130 },
    ]
    const level = buildStockLevel(totalsAfter(movements))
    expect(level.quantityOnHand).toBe(20)
    expect(level.costPriceEur).toBe(1.3)
  })

  it('returns the average to exactly where it was when a reversal uses the original cost', () => {
    const received = [
      { quantity: 10, unitCostCents: 100 },
      { quantity: 30, unitCostCents: 140 },
    ]
    const reversed = buildStockLevel(
      totalsAfter([
        ...received,
        { quantity: -12, unitCostCents: 130 },
        { quantity: 12, unitCostCents: 130 },
      ]),
    )
    expect(reversed).toEqual(buildStockLevel(totalsAfter(received)))
  })

  it('reports a negative quantity on hand rather than clamping it (research.md §6)', () => {
    const level = buildStockLevel(
      totalsAfter([
        { quantity: 2, unitCostCents: 100 },
        { quantity: -5, unitCostCents: 100 },
      ]),
    )
    expect(level.quantityOnHand).toBe(-3)
    // No positive quantity left to average over, so no cost price to report.
    expect(level.costPriceEur).toBeNull()
  })
})
