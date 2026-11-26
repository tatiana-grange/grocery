import { Collection } from '@mikro-orm/core'
import { describe, expect, it } from 'vitest'
import { CatalogMapper } from '../catalog.mapper'
import type { ProductPrice } from '../entities/product-price.entity'
import type { Product } from '../entities/product.entity'
import type { Supplier } from '../entities/supplier.entity'

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

describe('CatalogMapper.toSupplier', () => {
  const mapper = new CatalogMapper()

  function fakeSupplier(overrides: Record<string, unknown> = {}): Supplier {
    return {
      id: 's1',
      name: 'Moulin',
      type: 'producer',
      producerCategories: { isInitialized: () => true, getItems: () => [] },
      scheduleEnabled: false,
      version: 1,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      ...overrides,
    } as unknown as Supplier
  }

  const flour = {
    scheduleEnabled: true,
    scheduleFrequency: 'monthly',
    scheduleMonthWeek: 'first',
    scheduleDistributionWeekday: 5,
    scheduleSendingWeekday: 3,
    scheduleSendingHour: 8,
  }

  it('shows the next distribution and sending moment of the flour schedule at a fixed now', () => {
    const contract = mapper.toSupplier(fakeSupplier(flour), 0, new Date('2026-11-26T10:00:00Z'))

    expect(contract.orderSchedule).toMatchObject({ enabled: true, frequency: 'monthly' })
    expect(contract.nextOrder).toEqual({
      distributionDay: '2026-12-04',
      sendingAt: new Date('2026-12-02T07:00:00Z'),
    })
  })

  it('has no next order when the schedule is off, even with values kept', () => {
    const contract = mapper.toSupplier(
      fakeSupplier({ ...flour, scheduleEnabled: false }),
      0,
      new Date('2026-11-26T10:00:00Z'),
    )

    expect(contract.nextOrder).toBeNull()
    expect(contract.orderSchedule.frequency).toBe('monthly')
  })

  it('has no next order when the schedule is on but incomplete', () => {
    const contract = mapper.toSupplier(
      fakeSupplier({ ...flour, scheduleSendingHour: null }),
      0,
      new Date('2026-11-26T10:00:00Z'),
    )

    expect(contract.nextOrder).toBeNull()
  })
})
