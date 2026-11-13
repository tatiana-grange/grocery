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

  /**
   * Built at the distribution table and handed over in the same breath (FR-017), rather than
   * placed by the member and collected later. An in-store order can be either, so the flag is
   * the only way to tell them apart — and reversing an express sale has to cancel the order
   * instead of returning it to the waiting list, where nobody would ever come to collect it.
   */
  @Property()
  isExpress: boolean = false

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
