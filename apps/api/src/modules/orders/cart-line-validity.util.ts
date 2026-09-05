import type { Product } from '../catalog/entities/product.entity'
import type { OrderingModeChoice } from './contracts/order.contract'

export function productOffersOrderingMode(product: Product, mode: OrderingModeChoice): boolean {
  return product.orderingMode === 'both' || product.orderingMode === mode
}

export const CART_LINE_INVALID_REASON_CODES = [
  'product_archived',
  'ordering_mode_unavailable',
] as const
export type CartLineInvalidReasonCode = (typeof CART_LINE_INVALID_REASON_CODES)[number]

export interface LineValidity {
  isValid: boolean
  reasonCode: CartLineInvalidReasonCode | null
}

/**
 * Whether a cart line is still orderable — shared by the cart preview and checkout so a line
 * can't show as valid in one and get silently dropped (or vice versa) in the other. Returns a
 * code rather than a message so the frontend can render it in the member's language.
 */
export function checkLineValidity(
  product: Product,
  orderingMode: OrderingModeChoice,
): LineValidity {
  const isArchived = Boolean(product.archivedAt)
  const isValid = !isArchived && productOffersOrderingMode(product, orderingMode)
  return {
    isValid,
    reasonCode: isValid ? null : isArchived ? 'product_archived' : 'ordering_mode_unavailable',
  }
}
