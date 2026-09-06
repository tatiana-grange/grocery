import type { Rel } from '@mikro-orm/core'
import { Collection } from '@mikro-orm/core'
import {
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy'
import { Product } from '../../catalog/entities/product.entity'
import { OrderLine } from '../../orders/entities/order-line.entity'
import { ReceptionLine } from './reception-line.entity'
import { SupplierOrder } from './supplier-order.entity'

/**
 * One product's aggregated demand on a supplier order. Created once, by aggregation; its
 * `quantity` (the summed ordered amount) never changes afterward (data-model.md
 * "Cross-entity rules"). Received-so-far and discrepancy are computed at read time from the
 * reception lines, never stored.
 */
@Entity({ tableName: 'supplierOrderLine' })
@Unique({ properties: ['supplierOrder', 'product'] })
export class SupplierOrderLine {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => SupplierOrder, { fieldName: 'supplierOrderId' })
  @Index()
  supplierOrder!: Rel<SupplierOrder>

  @ManyToOne(() => Product, { fieldName: 'productId' })
  @Index()
  product!: Rel<Product>

  /** Piece count or kilograms per `product.saleMode`, same convention as `OrderLine.quantity`. */
  @Property({ type: 'decimal', precision: 10, scale: 3 })
  quantity!: string

  /** Member pre-order lines absorbed into this line — FR-002 traceability. */
  @OneToMany(() => OrderLine, (line) => line.supplierOrderLine)
  sourceOrderLines = new Collection<OrderLine>(this)

  @OneToMany(() => ReceptionLine, (line) => line.supplierOrderLine)
  receptionLines = new Collection<ReceptionLine>(this)

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
