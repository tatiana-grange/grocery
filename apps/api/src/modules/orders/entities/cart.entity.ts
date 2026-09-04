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
import { Member } from '../../members/entities/member.entity'
import { CartLine } from './cart-line.entity'

/**
 * One active cart per member. Created on the first `GET /cart` if it doesn't exist yet, and
 * never deleted afterwards — only emptied at checkout.
 */
@Entity({ tableName: 'cart' })
export class Cart {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => Member, { fieldName: 'memberId' })
  @Unique()
  @Index()
  member!: Rel<Member>

  @OneToMany(() => CartLine, (line) => line.cart, { orphanRemoval: true })
  lines = new Collection<CartLine>(this)

  @Property({ version: true })
  version!: number

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
