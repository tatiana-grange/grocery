import type { Rel } from '@mikro-orm/core'
import { Entity, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'
import { OrderLine } from '../../orders/entities/order-line.entity'
import { Handover } from './handover.entity'

/**
 * One product on a handover, with the quantity actually given. Write-once, like its parent.
 *
 * Kept separate from `OrderLine` on purpose: that row is lot 2's immutable checkout snapshot,
 * and the difference between what was ordered and what was handed over is exactly the
 * information FR-012 asks to keep visible. The difference is computed at read time
 * (`handedQuantity - orderLine.quantity`), never stored.
 */
@Entity({ tableName: 'handoverLine' })
export class HandoverLine {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => Handover, { fieldName: 'handoverId' })
  @Index()
  handover!: Rel<Handover>

  @ManyToOne(() => OrderLine, { fieldName: 'orderLineId' })
  @Index()
  orderLine!: Rel<OrderLine>

  /**
   * What was actually given. May be `0` (the member declined the line, FR-006), may exceed
   * the ordered quantity (FR-012), and is negative on a reversal line.
   */
  @Property({ type: 'decimal', precision: 10, scale: 3 })
  handedQuantity!: string

  /** Copied from the order line — the price recorded when the order was placed (FR-007). */
  @Property()
  unitPriceAmountCents!: number

  @Property()
  lineTotalAmountCents!: number

  @Property()
  createdAt: Date = new Date()
}
