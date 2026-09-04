import type { Rel } from '@mikro-orm/core'
import { Entity, Index, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy'
import type { OrderingModeChoice } from '../contracts/order.contract'
import { Product } from '../../catalog/entities/product.entity'
import { Cart } from './cart.entity'

/**
 * One line in a member's cart. `quantity` is a piece count when the product's `saleMode` is
 * `unit`, or kilograms (up to 3 decimals) when it is `weight` — the decimal column stores it
 * as an exact string, converted to a number at the contract boundary.
 *
 * Adding the same product under the same `orderingMode` merges into this row instead of
 * creating a duplicate (the unique constraint below); the same product under the *other*
 * ordering mode (when it supports `both`) is a separate line.
 */
@Entity({ tableName: 'cartLine' })
@Unique({ properties: ['cart', 'product', 'orderingMode'] })
export class CartLine {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => Cart, { fieldName: 'cartId' })
  @Index()
  cart!: Rel<Cart>

  @ManyToOne(() => Product, { fieldName: 'productId' })
  @Index()
  product!: Rel<Product>

  @Property()
  orderingMode!: OrderingModeChoice

  @Property({ type: 'decimal', precision: 10, scale: 3 })
  quantity!: string

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
