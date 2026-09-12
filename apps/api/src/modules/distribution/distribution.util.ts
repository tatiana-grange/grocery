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
