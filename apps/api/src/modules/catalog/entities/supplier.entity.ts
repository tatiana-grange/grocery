import type { SupplierType } from '../contracts/supplier.contract'
import { Collection } from '@mikro-orm/core'
import { Entity, Index, OneToMany, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'
import { Product } from './product.entity'

@Entity({ tableName: 'supplier' })
export class Supplier {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property()
  @Index()
  name!: string

  @Property()
  type: SupplierType = 'producer'

  @Property({ nullable: true })
  contactName?: string

  @Property({ nullable: true })
  contactEmail?: string

  @Property({ nullable: true })
  contactPhone?: string

  @Property({ nullable: true })
  notes?: string

  @Property({ nullable: true })
  @Index()
  archivedAt?: Date

  @OneToMany(() => Product, (product) => product.supplier)
  products = new Collection<Product>(this)

  @Property({ version: true })
  version!: number

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
