import { describe, expect, it } from 'vitest'
import type { StockLevel } from '../../inventory/inventory.util'
import type { SupplierOrder } from '../entities/supplier-order.entity'
import { PurchasingMapper } from '../purchasing.mapper'

/**
 * The mapper only reads entity properties and (initialized) collections, so these tests feed
 * it hand-built stand-ins rather than spinning up a database — the DB round-trip is covered
 * in the controller e2e spec.
 */
const fakeCollection = <T>(items: T[]) => ({
  isInitialized: () => true,
  getItems: () => items,
})

function makeLine(overrides: {
  id?: string
  quantity: string
  saleMode?: 'unit' | 'weight'
  weightTolerancePercent?: number | null
  orderIds?: string[]
  receivedQuantities?: string[]
}) {
  return {
    id: overrides.id ?? 'line-1',
    quantity: overrides.quantity,
    product: {
      id: 'product-1',
      name: 'Carrots',
      saleMode: overrides.saleMode ?? 'unit',
      weightTolerancePercent: overrides.weightTolerancePercent ?? null,
    },
    sourceOrderLines: fakeCollection(
      (overrides.orderIds ?? ['o1', 'o2']).map((id) => ({ order: { id } })),
    ),
    receptionLines: fakeCollection(
      (overrides.receivedQuantities ?? []).map((receivedQuantity) => ({ receivedQuantity })),
    ),
  }
}

function makeOrder(lines: ReturnType<typeof makeLine>[]): SupplierOrder {
  return {
    id: 'so-1',
    supplier: { id: 'sup-1', name: 'Ferme des Prés' },
    status: 'draft',
    sentAt: undefined,
    closedAt: undefined,
    version: 1,
    createdAt: new Date('2026-09-05T10:00:00Z'),
    lines: fakeCollection(lines),
    receptions: fakeCollection([]),
  } as unknown as SupplierOrder
}

describe('PurchasingMapper', () => {
  const mapper = new PurchasingMapper()
  const costs = new Map<string, StockLevel>()

  it('maps a line with its ordered quantity, contributing members, and no reception yet', () => {
    const line = makeLine({ quantity: '6', orderIds: ['o1', 'o2', 'o2'] })
    const result = mapper.toSupplierOrderLine(line as never, costs)

    expect(result.quantity).toBe(6)
    expect(result.receivedQuantity).toBe(0)
    expect(result.discrepancy).toBe('short') // nothing received yet, unit-sold
    expect(result.contributingMemberCount).toBe(2) // distinct orders
    expect(result.estimatedUnitCostEur).toBeNull()
  })

  it('carries a cost estimate through when the product has been received before', () => {
    costs.set('product-1', { quantityOnHand: 40, costPriceEur: 1.3 })
    const order = makeOrder([makeLine({ quantity: '10' })])
    const result = mapper.toSupplierOrder(order, costs)

    expect(result.estimatedTotalEur).toBe(13) // 10 * 1.30
    expect(result.hasUnknownCostLines).toBe(false)
    costs.delete('product-1')
  })

  it('flags the order as a partial estimate when a line has no known cost', () => {
    const order = makeOrder([makeLine({ quantity: '10' })])
    const result = mapper.toSupplierOrder(order, costs)

    expect(result.estimatedTotalEur).toBe(0)
    expect(result.hasUnknownCostLines).toBe(true)
  })

  it('computes received-so-far by summing the line’s reception lines', () => {
    const line = makeLine({ quantity: '10', receivedQuantities: ['4', '3.5'] })
    const result = mapper.toSupplierOrderLine(line as never, costs)

    expect(result.receivedQuantity).toBe(7.5)
    expect(result.discrepancy).toBe('short')
  })
})
