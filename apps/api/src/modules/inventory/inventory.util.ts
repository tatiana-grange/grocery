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

/** The two sums a stock level is built from, whoever added them up. */
export interface StockTotals {
  /** SUM(quantity). */
  quantity: number
  /** SUM(quantity * unitCostAmountCents). */
  costNumeratorCents: number
}

export function emptyStockLevel(): StockLevel {
  return { quantityOnHand: 0, costPriceEur: null }
}

/** Rounds to 3 decimals (grams) so the numeric-to-float conversion does not drift. */
function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

/**
 * The single definition of "a product's stock level and cost price" (research.md §4). Every
 * read path funnels through here so no two of them can round or average differently.
 *
 * The sums themselves are done by the database — see `InventoryService.getStockLevels` — so
 * that a shop page never has to load the movement ledger to show a stock figure.
 */
export function buildStockLevel(totals: StockTotals): StockLevel {
  const { quantity, costNumeratorCents } = totals
  return {
    quantityOnHand: round3(quantity),
    costPriceEur: quantity > 0 ? centsToEur(costNumeratorCents / quantity) : null,
  }
}
