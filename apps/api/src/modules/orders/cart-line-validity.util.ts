import type { Product } from '../catalog/entities/product.entity'
import type { OrderingModeChoice } from './contracts/order.contract'

export function productOffersOrderingMode(product: Product, mode: OrderingModeChoice): boolean {
  return product.orderingMode === 'both' || product.orderingMode === mode
}

export interface LineValidity {
  isValid: boolean
  reason: string | null
}

/**
 * Whether a cart line is still orderable — shared by the cart preview and checkout so a line
 * can't show as valid in one and get silently dropped (or vice versa) in the other.
 */
export function checkLineValidity(
  product: Product,
  orderingMode: OrderingModeChoice,
): LineValidity {
  const isArchived = Boolean(product.archivedAt)
  const isValid = !isArchived && productOffersOrderingMode(product, orderingMode)
  return {
    isValid,
    reason: isValid
      ? null
      : isArchived
        ? 'This product is no longer available'
        : 'This product no longer offers this ordering type',
  }
}
