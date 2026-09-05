import type { ProductPricingUnit, ProductSaleMode } from './contracts/product.contract'
import type { Product } from './entities/product.entity'
import type { ProductPrice } from './entities/product-price.entity'

export function eurToCents(eur: number): number {
  return Math.round(eur * 100)
}

export function centsToEur(cents: number): number {
  return Math.round(cents) / 100
}

export function pricingUnitFor(saleMode: ProductSaleMode): ProductPricingUnit {
  return saleMode === 'weight' ? 'kg' : 'piece'
}

/**
 * The product's currently open price row (`validTo IS NULL`) — lot 1 guarantees at most one.
 * Shared so the "what does this product cost right now" rule lives in one place instead of
 * being re-derived at every call site that needs a price.
 */
export function currentPrice(product: Product): ProductPrice | undefined {
  if (!product.prices.isInitialized()) return undefined
  return product.prices.getItems().find((price) => !price.validTo)
}
