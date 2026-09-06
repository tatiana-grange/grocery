import type { ProductSaleMode } from '../catalog/contracts/product.contract'
import type { DiscrepancyKind } from './contracts/reception.contract'

/** Sums decimal-string quantities and returns a string with at most 3 decimals (no drift). */
export function sumQuantities(quantities: ReadonlyArray<number | string>): string {
  const total = quantities.reduce<number>((sum, q) => sum + Number(q), 0)
  return (Math.round(total * 1000) / 1000).toString()
}

/**
 * Compares a received quantity to what was ordered (research.md §5). A `unit`-sold line
 * flags on any non-zero difference; a `weight` line flags only when the difference exceeds
 * `weightTolerancePercent` of the ordered quantity — a small variance is expected and normal
 * for goods weighed at delivery. Informational only; never blocks a reception (FR-012).
 */
export function discrepancyFor(
  saleMode: ProductSaleMode,
  orderedQuantity: number,
  receivedQuantity: number,
  weightTolerancePercent: number | null | undefined,
): DiscrepancyKind {
  const difference = receivedQuantity - orderedQuantity
  const epsilon = 1e-9
  if (Math.abs(difference) < epsilon) return 'none'
  if (saleMode === 'weight') {
    const band = ((weightTolerancePercent ?? 0) / 100) * orderedQuantity
    if (Math.abs(difference) <= band + epsilon) return 'none'
  }
  return difference < 0 ? 'short' : 'over'
}
