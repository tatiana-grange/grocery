import { Collection } from '@mikro-orm/core'
import { describe, expect, it } from 'vitest'
import { CatalogMapper } from '../catalog.mapper'
import type { ProductPrice } from '../entities/product-price.entity'
import type { Product } from '../entities/product.entity'

function fakeProduct(overrides: Partial<Product> = {}): Product {
  const product = {
    id: 'p1',
    name: 'Carrots',
    description: undefined,
    supplier: { id: 's1', name: 'Ferme' },
    category: { id: 'c1', name: 'Légumes' },
    saleMode: 'weight',
    orderingMode: 'in_store',
    photos: [],
    labels: [],
    barcode: undefined,
    archivedAt: undefined,
    version: 1,
    createdAt: new Date(),
    prices: {
      isInitialized: () => true,
      getItems: () => [] as ProductPrice[],
    },
    ...overrides,
  } as unknown as Product
  return product
}

describe('CatalogMapper.toProduct', () => {
  const mapper = new CatalogMapper()

  it('derives the pricing unit from the sale mode', () => {
    expect(mapper.toProduct(fakeProduct({ saleMode: 'weight' })).pricingUnit).toBe('kg')
    expect(mapper.toProduct(fakeProduct({ saleMode: 'unit' })).pricingUnit).toBe('piece')
  })

  it('exposes the open price window as euros and null when there is none', () => {
    const open = { validTo: undefined, amountCents: 240 } as ProductPrice
    const closed = { validTo: new Date(), amountCents: 200 } as ProductPrice

    const withPrice = fakeProduct({
      prices: {
        isInitialized: () => true,
        getItems: () => [closed, open],
      } as unknown as Collection<ProductPrice>,
    })
    expect(mapper.toProduct(withPrice).currentPriceEur).toBe(2.4)

    const noOpen = fakeProduct({
      prices: {
        isInitialized: () => true,
        getItems: () => [closed],
      } as unknown as Collection<ProductPrice>,
    })
    expect(mapper.toProduct(noOpen).currentPriceEur).toBeNull()
  })
})
