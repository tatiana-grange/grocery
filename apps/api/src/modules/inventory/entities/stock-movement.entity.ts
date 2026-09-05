import type { Rel } from '@mikro-orm/core'
import { Entity, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'
import type { StockMovementReason } from '../contracts/stock.contract'
import { Product } from '../../catalog/entities/product.entity'
import { ReceptionLine } from '../../purchasing/entities/reception-line.entity'

/**
 * The only source of truth for a product's stock level and cost price (Principle II). An
 * append-only ledger row: `createdAt` only, never edited. In lot 3 every movement is an
 * inbound reception, so `quantity` is always positive and `unitCostAmountCents` always
 * present; the shape leaves room for a future signed, sometimes-costless movement type
 * without a schema change (lot 3 does not build that type).
 *
 * Derived per product, never stored:
 * - stock level      = SUM(quantity)
 * - cost price (EUR) = SUM(quantity * unitCostAmountCents) / SUM(quantity), null when no rows
 */
@Entity({ tableName: 'stockMovement' })
export class StockMovement {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => Product, { fieldName: 'productId' })
  @Index()
  product!: Rel<Product>

  /** Positive in lot 3 (an inbound movement). Same unit convention as elsewhere. */
  @Property({ type: 'decimal', precision: 10, scale: 3 })
  quantity!: string

  @Property()
  unitCostAmountCents!: number

  @Property()
  currency: string = 'EUR'

  @Property()
  reason: StockMovementReason = 'reception'

  /** Traces the movement back to its source (SC-003). Nullable for future non-reception types. */
  @ManyToOne(() => ReceptionLine, { fieldName: 'receptionLineId', nullable: true })
  @Index()
  receptionLine?: Rel<ReceptionLine>

  @Property()
  createdAt: Date = new Date()
}
