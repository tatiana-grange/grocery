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
import { Product } from './product.entity'

@Entity({ tableName: 'category' })
export class Category {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property()
  @Index()
  name!: string

  /** One level of nesting is allowed. */
  @ManyToOne(() => Category, { fieldName: 'parentId', nullable: true })
  parent?: Rel<Category>

  @Property({ nullable: true })
  @Index()
  archivedAt?: Date

  @OneToMany(() => Product, (product) => product.category)
  products = new Collection<Product>(this)

  @Property({ version: true })
  version!: number

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
