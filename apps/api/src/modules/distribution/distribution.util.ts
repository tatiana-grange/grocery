import type { OrderingModeChoice } from '../orders/contracts/order.contract'
import type { NotReadyReasonCode } from './contracts/distribution-screen.contract'

export interface LineReadiness {
  isReady: boolean
  notReadyReason: NotReadyReasonCode | null
}

/**
 * Whether a line can be handed over now (FR-003).
 *
 * A pre-order line is ready once lot 3 marked it `fulfilledAt` — the first reception
 * covering its product. Lot 3 set that marker for exactly this purpose. An in-store line is
 * always ready: it was bought from the shelf, and the shelf is what the member is standing
 * in front of.
 */
export function lineReadiness(
  orderingMode: OrderingModeChoice,
  fulfilledAt: Date | null | undefined,
): LineReadiness {
  if (orderingMode === 'in_store') return { isReady: true, notReadyReason: null }
  return fulfilledAt
    ? { isReady: true, notReadyReason: null }
    : { isReady: false, notReadyReason: 'awaiting_reception' }
}

/** One line as the handover transaction sees it, before anything is written. */
export interface PricedHandoverLine {
  orderLineId: string
  handedQuantity: number
  unitPriceAmountCents: number
  lineTotalAmountCents: number
}

/**
 * What a handed-over line costs, at the price recorded when the order was placed (FR-007) —
 * never today's price. Rounded to whole cents, matching how checkout priced the line in the
 * first place.
 */
export function lineTotalCents(handedQuantity: number, unitPriceAmountCents: number): number {
  return Math.round(handedQuantity * unitPriceAmountCents)
}

/** The handover's total: the sum of its lines. A line handed over at zero contributes zero. */
export function handoverTotalCents(lines: PricedHandoverLine[]): number {
  return lines.reduce((sum, line) => sum + line.lineTotalAmountCents, 0)
}

/**
 * Whether the balance covers the handover (FR-027).
 *
 * The comparison is deliberately `<=`: a total that exactly equals the balance is allowed.
 * Spending your last euro is not an overdraft.
 */
export function balanceCovers(totalCents: number, balanceCents: number): boolean {
  return totalCents <= balanceCents
}

/**
 * Whether every line of the order is now settled, and the order can flip to `handed_over`
 * (FR-013).
 *
 * A line is settled when this handover covers it — including at zero, which is the member
 * declining it — or when an earlier, un-reversed handover already did. Derived rather than
 * tracked in a column: a reversal would otherwise have to un-set a marker that lot 3's
 * precedent says is set once and never reset.
 */
export function isOrderFullySettled(
  allOrderLineIds: string[],
  alreadySettledLineIds: Set<string>,
  settledNowLineIds: Set<string>,
): boolean {
  return allOrderLineIds.every((id) => alreadySettledLineIds.has(id) || settledNowLineIds.has(id))
}
