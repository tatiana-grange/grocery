import type { Rel } from '@mikro-orm/core'
import { Collection } from '@mikro-orm/core'
import {
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy'
import { ReceptionLine } from './reception-line.entity'
import { SupplierOrder } from './supplier-order.entity'

/**
 * One delivery event against a sent supplier order. A supplier order can have several
 * (FR-013). Written once and never edited — carries `createdAt` but no `updatedAt`, the same
 * deviation lot 2 recorded for `OrderLine` (research.md §7). A correction is a brand-new
 * reception, never an edit (FR-014).
 */
@Entity({ tableName: 'reception' })
export class Reception {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => SupplierOrder, { fieldName: 'supplierOrderId' })
  @Index()
  supplierOrder!: Rel<SupplierOrder>

  /** When the reception was confirmed. Set once, at creation. */
  @Property()
  receivedAt: Date = new Date()

  @OneToMany(() => ReceptionLine, (line) => line.reception)
  lines = new Collection<ReceptionLine>(this)

  @Property()
  createdAt: Date = new Date()
}
