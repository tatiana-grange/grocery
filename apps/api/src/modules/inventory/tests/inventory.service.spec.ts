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
