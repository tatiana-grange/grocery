import type { SupplierDeliveryMode, SupplierType } from '../contracts/supplier.contract'
import type { Rel } from '@mikro-orm/core'
import { Collection } from '@mikro-orm/core'
import {
  Entity,
  Index,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy'
import { ProducerCategory } from './producer-category.entity'
import { Product } from './product.entity'
import { Referent } from './referent.entity'

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

  /** How goods move from this supplier to the épicerie. Unset until someone picks one. */
  @Property({ nullable: true })
  deliveryMode?: SupplierDeliveryMode

  @ManyToOne(() => Referent, { fieldName: 'referentId', nullable: true })
  @Index()
  referent?: Rel<Referent>

  @ManyToMany(() => ProducerCategory, (category) => category.suppliers, {
    owner: true,
    pivotTable: 'supplierProducerCategory',
  })
  producerCategories = new Collection<ProducerCategory>(this)

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
