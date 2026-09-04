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
import type { OrderingModeChoice, OrderStatus } from '../contracts/order.contract'
import { Member } from '../../members/entities/member.entity'
import { OrderLine } from './order-line.entity'

/**
 * Created at checkout, one per ordering type present in the cart at that moment. `orderingMode`
 * is fixed for the life of the order — every line on it shares this value.
 */
@Entity({ tableName: 'order' })
export class Order {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => Member, { fieldName: 'memberId' })
  @Index()
  member!: Rel<Member>

  @Property()
  orderingMode!: OrderingModeChoice

  @Property()
  status: OrderStatus = 'pending'

  /** Sum of its lines' `lineTotalAmountCents`, stored so it survives later price changes. */
  @Property()
  totalAmountCents!: number

  @Property()
  currency: string = 'EUR'

  @Property()
  placedAt: Date = new Date()

  @Property({ nullable: true })
  cancelledAt?: Date

  @OneToMany(() => OrderLine, (line) => line.order)
  lines = new Collection<OrderLine>(this)

  /** Optimistic lock — the cancel action sends the version it loaded. */
  @Property({ version: true })
  version!: number

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
