import type { ProductSaleMode } from '../catalog/contracts/product.contract'
import type { DiscrepancyKind } from './contracts/reception.contract'
import type { SupplierOrderStatus } from './contracts/supplier-order.contract'

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

export type TransitionRefusal = 'wrong_status' | 'stale_version' | null

/**
 * Guards a supplier-order status transition (`send`, `close`). Returns why it is refused, or
 * `null` when it may proceed: the order must currently be in `from`, and the caller's
 * `sentVersion` must match the loaded row (optimistic lock). FR-007 / FR-008 / FR-021.
 */
export function checkTransition(
  current: { status: SupplierOrderStatus; version: number },
  from: SupplierOrderStatus,
  sentVersion: number,
): TransitionRefusal {
  if (current.status !== from) return 'wrong_status'
  if (current.version !== sentVersion) return 'stale_version'
  return null
}
