import type { StockMovementReason } from '../inventory/contracts/stock.contract'
import type { Period } from './period.util'

/**
 * The period filters and the per-row cost expression, in one file. The P&L sums them in the
 * database and the exports read the same rows, so the two cannot drift apart.
 * Every value reaches the database as a bound parameter, never inside the text.
 */

/** Handover lines, with the handover that puts them in a period. */
export const SALE_LINES_FROM = `"handoverLine" hl join "handover" h on h."id" = hl."handoverId"`

/** A handover belongs to a period by its own time, and so do its lines and their movements. */
export const HANDOVER_IN_PERIOD = `h."createdAt" >= ?::timestamptz and h."createdAt" < ?::timestamptz`

/** Stock movements written by handovers, with their line and handover. */
export const SALE_MOVEMENTS_FROM = `"stockMovement" sm
  join "handoverLine" hl on hl."id" = sm."handoverLineId"
  join "handover" h on h."id" = hl."handoverId"`

const SALE_ISSUE_REASON = 'distribution' satisfies StockMovementReason
const SALE_REVERSAL_REASON = 'distribution_reversal' satisfies StockMovementReason

export const SALE_MOVEMENT_REASONS = `sm."reason" in ('${SALE_ISSUE_REASON}', '${SALE_REVERSAL_REASON}')`

/**
 * One movement's cost in whole cents, rounded half away from zero. An issue has a negative
 * quantity, so its cost is positive; a reversal has the opposite quantity and the same unit
 * cost, so its rounded cost is exactly the opposite.
 */
export const LINE_COST_CENTS = `round(-sm."quantity" * sm."unitCostAmountCents")`

export const FEE_PAID_IN_PERIOD = `mp."paidAt" >= ?::timestamptz and mp."paidAt" < ?::timestamptz`

export const WALLET_ENTRY_IN_PERIOD = `we."createdAt" >= ?::timestamptz and we."createdAt" < ?::timestamptz`

export const RECEPTION_IN_PERIOD = `r."receivedAt" >= ?::timestamptz and r."receivedAt" < ?::timestamptz`

/** An expense has a calendar day, compared with the period's first and last day. */
export const EXPENSE_IN_PERIOD = `e."spentOn" >= ?::date and e."spentOn" <= ?::date`

/** The two instants that bound a period, as the parameters of the instant filters. */
export function instantParams(period: Period): string[] {
  return [period.startsAt.toISOString(), period.endsBefore.toISOString()]
}

/** The two days that bound a period, as the parameters of `EXPENSE_IN_PERIOD`. */
export function dayParams(period: Period): string[] {
  return [period.from, period.to]
}
