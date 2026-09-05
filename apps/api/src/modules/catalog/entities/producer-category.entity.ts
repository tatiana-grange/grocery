import { Collection } from '@mikro-orm/core'
import { Entity, Index, ManyToMany, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'
import { Supplier } from './supplier.entity'

/** A tag for what a supplier produces (e.g. "Boissons", "Fromages") — flat, no nesting. */
@Entity({ tableName: 'producerCategory' })
export class ProducerCategory {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property()
  @Index()
  name!: string

  @Property({ nullable: true })
  @Index()
  archivedAt?: Date

  @ManyToMany(() => Supplier, (supplier) => supplier.producerCategories)
  suppliers = new Collection<Supplier>(this)

  @Property({ version: true })
  version!: number

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
