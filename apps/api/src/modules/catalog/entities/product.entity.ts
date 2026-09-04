import type { ProductLabel, ProductSaleMode } from '../contracts/product.contract'
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
import { Category } from './category.entity'
import { ProductPrice } from './product-price.entity'
import { Supplier } from './supplier.entity'

@Entity({ tableName: 'product' })
export class Product {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property()
  @Index()
  name!: string

  @Property({ nullable: true })
  description?: string

  @ManyToOne(() => Supplier, { fieldName: 'supplierId' })
  @Index()
  supplier!: Rel<Supplier>

  @ManyToOne(() => Category, { fieldName: 'categoryId' })
  @Index()
  category!: Rel<Category>

  /** `unit` = sold per piece, `weight` = priced per kilogram. */
  @Property()
  saleMode: ProductSaleMode = 'unit'

  @Property({ type: 'array' })
  photos: string[] = []

  @Property({ type: 'array' })
  labels: ProductLabel[] = []

  @Property({ nullable: true })
  @Unique()
  barcode?: string

  /** Reserved for lot 3 (pre-order weight estimates); unused in lot 1. */
  @Property({ nullable: true })
  averageWeightGrams?: number

  @Property({ nullable: true })
  weightTolerancePercent?: number

  @Property({ nullable: true })
  @Index()
  archivedAt?: Date

  @OneToMany(() => ProductPrice, (price) => price.product)
  prices = new Collection<ProductPrice>(this)

  @Property({ version: true })
  version!: number

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
