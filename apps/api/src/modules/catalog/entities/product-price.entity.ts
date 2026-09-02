import type { Rel } from '@mikro-orm/core'
import { Entity, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'
import { User } from '../../auth/auth.entity'
import { Product } from './product.entity'

/**
 * Append-only, windowed price history. A price change closes the current open row
 * (`validTo = now`) and inserts a new open row (`validTo = null`) in one transaction.
 * The current price is the row with `validTo IS NULL` — there is exactly one per product.
 * Amount is per piece or per kilogram depending on the product's `saleMode`.
 */
@Entity({ tableName: 'productPrice' })
@Index({ properties: ['product', 'validTo'] })
export class ProductPrice {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => Product, { fieldName: 'productId' })
  product!: Rel<Product>

  @Property()
  amountCents!: number

  @Property()
  currency: string = 'EUR'

  @Property()
  validFrom!: Date

  @Property({ nullable: true })
  validTo?: Date

  @ManyToOne(() => User, { fieldName: 'setByUserId' })
  setByUser!: Rel<User>

  @Property()
  createdAt: Date = new Date()
}
