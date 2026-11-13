import { describe, expect, it } from 'vitest'
import type { HandoverLine } from '../entities/handover-line.entity'
import { DistributionMapper } from '../distribution.mapper'

/**
 * The mapper is pure, so it is tested with plain shapes rather than a database. What matters
 * here is the read-time difference between what was ordered and what was handed over: it is
 * deliberately not stored, so it cannot drift from the two numbers it derives from (FR-012).
 */
describe('DistributionMapper.toHandoverLine', () => {
  const mapper = new DistributionMapper()

  const line = (handedQuantity: string, orderedQuantity: string): HandoverLine =>
    ({
      id: 'handover-line-1',
      handedQuantity,
      unitPriceAmountCents: 2000,
      lineTotalAmountCents: Math.round(Number(handedQuantity) * 2000),
      orderLine: {
        id: 'order-line-1',
        productNameSnapshot: 'Comté',
        quantity: orderedQuantity,
      },
    }) as unknown as HandoverLine

  it('reports no difference when exactly what was ordered is handed over', () => {
    expect(mapper.toHandoverLine(line('2', '2')).differenceQuantity).toBe(0)
  })

  it('reports a negative difference when less was handed over', () => {
    const mapped = mapper.toHandoverLine(line('1.5', '2'))
    expect(mapped.handedQuantity).toBe(1.5)
    expect(mapped.orderedQuantity).toBe(2)
    expect(mapped.differenceQuantity).toBe(-0.5)
  })

  it('reports a positive difference when more was handed over (FR-012)', () => {
    expect(mapper.toHandoverLine(line('0.6', '0.5')).differenceQuantity).toBeCloseTo(0.1, 3)
  })

  it('keeps the difference free of float noise at 3 decimals', () => {
    expect(mapper.toHandoverLine(line('0.3', '0.1')).differenceQuantity).toBe(0.2)
  })

  it('carries the checkout snapshot name, not the product’s current one', () => {
    expect(mapper.toHandoverLine(line('1', '1')).productName).toBe('Comté')
  })

  it('reports the line total in euros', () => {
    expect(mapper.toHandoverLine(line('0.6', '0.5')).lineTotalEur).toBe(12)
  })
})
