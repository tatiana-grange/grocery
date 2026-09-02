import type { ProductPricingUnit, ProductSaleMode } from './contracts/product.contract'

export function eurToCents(eur: number): number {
  return Math.round(eur * 100)
}

export function centsToEur(cents: number): number {
  return Math.round(cents) / 100
}

export function pricingUnitFor(saleMode: ProductSaleMode): ProductPricingUnit {
  return saleMode === 'weight' ? 'kg' : 'piece'
}
