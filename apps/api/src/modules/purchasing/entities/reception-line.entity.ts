import type { Rel } from '@mikro-orm/core'
import { Entity, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'
import { Reception } from './reception.entity'
import { SupplierOrderLine } from './supplier-order-line.entity'

/**
 * One product's actual delivery detail within a reception. Written once, never edited (same
 * as `Reception`). `receivedQuantity` may be `0` — a line that did not arrive at all is
 * valid and is flagged fully short.
 */
@Entity({ tableName: 'receptionLine' })
export class ReceptionLine {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => Reception, { fieldName: 'receptionId' })
  @Index()
  reception!: Rel<Reception>

  @ManyToOne(() => SupplierOrderLine, { fieldName: 'supplierOrderLineId' })
  @Index()
  supplierOrderLine!: Rel<SupplierOrderLine>

  /** `>= 0`. Same unit convention as `SupplierOrderLine.quantity`. */
  @Property({ type: 'decimal', precision: 10, scale: 3 })
  receivedQuantity!: string

  /** `>= 0`. The unit cost actually paid for this delivery — feeds the weighted average cost price. */
  @Property()
  unitCostAmountCents!: number

  @Property()
  currency: string = 'EUR'

  @Property()
  createdAt: Date = new Date()
}
