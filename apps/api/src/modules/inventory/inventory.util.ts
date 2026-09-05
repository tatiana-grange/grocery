import { centsToEur } from '../catalog/catalog.util'

/** Stock level and weighted average cost price for one product, derived from movement rows. */
export interface StockLevel {
  /** SUM(quantity) over the product's movements — `0` when there are none. */
  quantityOnHand: number
  /**
   * SUM(quantity * unitCostAmountCents) / SUM(quantity), in euros — `null` when the product
   * has never been received (FR-020) or the movements net to a zero quantity.
   */
  costPriceEur: number | null
}

export function emptyStockLevel(): StockLevel {
  return { quantityOnHand: 0, costPriceEur: null }
}

/** Rounds to 3 decimals (grams) so repeated float addition does not drift. */
function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

/**
 * The single definition of "a product's stock level and cost price" (research.md §4). Every
 * read path funnels through here so the SQL sum and any in-memory sum can never diverge.
 */
export function deriveStockLevel(
  movements: ReadonlyArray<{ quantity: number | string; unitCostAmountCents: number }>,
): StockLevel {
  let quantity = 0
  let costNumeratorCents = 0
  for (const movement of movements) {
    const q = Number(movement.quantity)
    quantity += q
    costNumeratorCents += q * movement.unitCostAmountCents
  }
  return {
    quantityOnHand: round3(quantity),
    costPriceEur: quantity > 0 ? centsToEur(costNumeratorCents / quantity) : null,
  }
}
