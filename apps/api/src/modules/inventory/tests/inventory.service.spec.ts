import { describe, expect, it } from 'vitest'
import { deriveStockLevel, emptyStockLevel } from '../inventory.util'

/**
 * The DB-backed side of `InventoryService` (queries, pagination) is exercised in
 * `inventory.controller.e2e-spec.ts`. These unit tests pin the money/stock formula itself —
 * required by Principle IV for stock and cost-price logic.
 */
describe('deriveStockLevel', () => {
  it('sums quantities across movements', () => {
    const level = deriveStockLevel([
      { quantity: '3', unitCostAmountCents: 100 },
      { quantity: '2.5', unitCostAmountCents: 100 },
    ])
    expect(level.quantityOnHand).toBe(5.5)
  })

  it('takes the quantity-weighted average cost across movements at different unit costs', () => {
    // 10 @ 1.00 € and 30 @ 1.40 € → (10*100 + 30*140) / 40 = 130 cents = 1.30 €
    const level = deriveStockLevel([
      { quantity: '10', unitCostAmountCents: 100 },
      { quantity: '30', unitCostAmountCents: 140 },
    ])
    expect(level.quantityOnHand).toBe(40)
    expect(level.costPriceEur).toBe(1.3)
  })

  it('reports 0 / null for a product with no movements (FR-020)', () => {
    expect(deriveStockLevel([])).toEqual(emptyStockLevel())
    expect(deriveStockLevel([])).toEqual({ quantityOnHand: 0, costPriceEur: null })
  })

  it('does not drift on repeated 3-decimal addition', () => {
    const level = deriveStockLevel([
      { quantity: '0.1', unitCostAmountCents: 200 },
      { quantity: '0.2', unitCostAmountCents: 200 },
    ])
    expect(level.quantityOnHand).toBe(0.3)
  })

  it('accepts numeric quantities as well as decimal strings', () => {
    const level = deriveStockLevel([{ quantity: 4, unitCostAmountCents: 250 }])
    expect(level.quantityOnHand).toBe(4)
    expect(level.costPriceEur).toBe(2.5)
  })
})
