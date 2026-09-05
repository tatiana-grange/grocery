import type { Rel } from '@mikro-orm/core'
import { Entity, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'
import { Product } from '../../catalog/entities/product.entity'
import { SupplierOrderLine } from '../../purchasing/entities/supplier-order-line.entity'
import { Order } from './order.entity'

/**
 * An immutable snapshot, written once at checkout and never edited afterward — same spirit as
 * Principle II's append-only ledger rows, though this is not the money/stock ledger itself.
 * Deliberately carries `createdAt` but no `updatedAt`: an `updatedAt` on a row that must never
 * change would always equal `createdAt`, and if it ever moved it would signal a bug rather
 * than record useful history (see plan.md Complexity Tracking).
 */
@Entity({ tableName: 'orderLine' })
export class OrderLine {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => Order, { fieldName: 'orderId' })
  @Index()
  order!: Rel<Order>

  /** Kept even if the product is later archived — archiving never deletes this row. */
  @ManyToOne(() => Product, { fieldName: 'productId' })
  product!: Rel<Product>

  /** Copied at checkout so the line still reads sensibly if the product is later renamed. */
  @Property()
  productNameSnapshot!: string

  @Property({ type: 'decimal', precision: 10, scale: 3 })
  quantity!: string

  /** The product's price at the moment of checkout. */
  @Property()
  unitPriceAmountCents!: number

  @Property()
  lineTotalAmountCents!: number

  /**
   * Set once, at aggregation time (lot 3, research.md §3). `null` means "still pending, not
   * yet aggregated for any supplier" — exactly the set aggregation queries against. Not an
   * edit to the checkout snapshot above; a one-time record of what happened to the line
   * afterward, so no `updatedAt` bump.
   */
  @ManyToOne(() => SupplierOrderLine, { fieldName: 'supplierOrderLineId', nullable: true })
  @Index()
  supplierOrderLine?: Rel<SupplierOrderLine>

  /**
   * Set once, the first time a reception is confirmed for this line's product on its linked
   * supplier order (lot 3, research.md §6). Never reset.
   */
  @Property({ nullable: true })
  fulfilledAt?: Date

  @Property()
  createdAt: Date = new Date()
}
