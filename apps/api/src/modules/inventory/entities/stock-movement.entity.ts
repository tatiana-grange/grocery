import type { Rel } from '@mikro-orm/core'
import { Entity, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'
import type { StockMovementReason } from '../contracts/stock.contract'
import { Product } from '../../catalog/entities/product.entity'
import { HandoverLine } from '../../distribution/entities/handover-line.entity'
import { ReceptionLine } from '../../purchasing/entities/reception-line.entity'

/**
 * The only source of truth for a product's stock level and cost price (Principle II). An
 * append-only ledger row: `createdAt` only, never edited.
 *
 * Derived per product, never stored:
 * - stock level      = SUM(quantity)
 * - cost price (EUR) = SUM(quantity * unitCostAmountCents) / SUM(quantity), null when no rows
 *
 * Lot 3 only ever wrote inbound receptions. Lot 4 makes `quantity` genuinely signed: a
 * handover writes a negative row valued at the product's **current** weighted average, which
 * leaves that average unchanged — (N − q·N/Q) / (Q − q) = N/Q — so the two derivations above
 * keep working untouched in both directions (research.md §5). Stock is allowed to go below
 * zero: at the table the shelf is the source of truth, and a negative figure is the signal
 * that a stock count is due.
 */
@Entity({ tableName: 'stockMovement' })
export class StockMovement {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => Product, { fieldName: 'productId' })
  @Index()
  product!: Rel<Product>

  /** Signed: positive on a reception, negative on a handover. */
  @Property({ type: 'decimal', precision: 10, scale: 3 })
  quantity!: string

  @Property()
  unitCostAmountCents!: number

  @Property()
  currency: string = 'EUR'

  @Property()
  reason: StockMovementReason = 'reception'

  /** Traces an inbound movement back to its reception (lot 3, SC-003). */
  @ManyToOne(() => ReceptionLine, { fieldName: 'receptionLineId', nullable: true })
  @Index()
  receptionLine?: Rel<ReceptionLine>

  /**
   * Traces an outbound movement — or the row that reverses one — back to its handover
   * (lot 4, SC-004). Exactly one of `receptionLine` / `handoverLine` is set.
   */
  @ManyToOne(() => HandoverLine, { fieldName: 'handoverLineId', nullable: true })
  @Index()
  handoverLine?: Rel<HandoverLine>

  @Property()
  createdAt: Date = new Date()
}
