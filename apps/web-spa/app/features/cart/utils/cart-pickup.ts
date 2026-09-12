import type { CartLine } from '@grocery/openapi-generator/client/types.gen'

/** One cart line, told apart by when the shopper can actually walk away with it. */
export interface CartLinePickup {
  line: CartLine
  /** Covered by what is already on the shelf, in the line's own unit (pieces or kilograms). */
  now: number
  /** Waiting on the supplier's next delivery, same unit. */
  later: number
  /** The line falls on both sides, so the row spells the two amounts out. */
  split: boolean
}

const round3 = (value: number) => Number(value.toFixed(3))

/**
 * Tells each cart line apart by when it can be collected: what the shelf already covers, and
 * what has to wait for a delivery.
 *
 * A pre-order counts as collectable at the next distribution whole, whatever the shelf holds —
 * that is the promise the shop makes on it today, and it gets its own treatment later. It does
 * not draw on the shelf either: the stock stays for the in-store lines, which are the only ones
 * matched against it.
 *
 * Stock is otherwise consumed line by line, in the order the cart returns them, so a product
 * appearing twice draws from one shelf. A line can land on both sides — five ordered against
 * three on the shelf is three now and two later — and that is the case the cart row explains.
 *
 * What "on the shelf" means is what receptions recorded; nothing subtracts a member order from
 * it yet, so this says what the shop received, not what other members have already claimed.
 */
export function splitCartByPickup(lines: readonly CartLine[]): CartLinePickup[] {
  const remainingStock = new Map<string, number>()

  return lines.map((line) => {
    if (line.orderingMode === 'pre_order') {
      return { line, now: line.quantity, later: 0, split: false }
    }

    const productId = line.product.id
    // `?? 0` only bites against an API too old to send the field.
    const stock = remainingStock.get(productId) ?? line.product.quantityOnHand ?? 0
    const now = round3(Math.min(line.quantity, stock))
    remainingStock.set(productId, round3(stock - now))

    const later = round3(line.quantity - now)
    return { line, now, later, split: now > 0 && later > 0 }
  })
}
