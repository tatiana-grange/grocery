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
import type { SupplierOrderStatus } from '../contracts/supplier-order.contract'
import { Supplier } from '../../catalog/entities/supplier.entity'
import { Reception } from './reception.entity'
import { SupplierOrderLine } from './supplier-order-line.entity'

/**
 * Created by aggregation, one per supplier per aggregation run. Walks the
 * `draft → sent → received / closed` state machine (data-model.md). `status` is a
 * contract-level enum, never modelled on the entity.
 */
@Entity({ tableName: 'supplierOrder' })
export class SupplierOrder {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => Supplier, { fieldName: 'supplierId' })
  @Index()
  supplier!: Rel<Supplier>

  @Property()
  status: SupplierOrderStatus = 'draft'

  /** Set once, by the "send" action. */
  @Property({ nullable: true })
  sentAt?: Date

  /** Set once, by the "close" action or automatically alongside `status = 'received'`. */
  @Property({ nullable: true })
  closedAt?: Date

  @OneToMany(() => SupplierOrderLine, (line) => line.supplierOrder)
  lines = new Collection<SupplierOrderLine>(this)

  @OneToMany(() => Reception, (reception) => reception.supplierOrder)
  receptions = new Collection<Reception>(this)

  /** Optimistic lock — send / receive / close each transition `status`. */
  @Property({ version: true })
  version!: number

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
