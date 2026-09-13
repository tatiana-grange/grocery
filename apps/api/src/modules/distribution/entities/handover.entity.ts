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
import type { HandoverKind } from '../contracts/handover.contract'
import { User } from '../../auth/auth.entity'
import { Member } from '../../members/entities/member.entity'
import { Order } from '../../orders/entities/order.entity'
import { HandoverLine } from './handover-line.entity'

/**
 * A record of goods physically given to a member at a point in time. Write-once, in the same
 * spirit as lot 3's `Reception`: `createdAt` only, never edited, never deleted. A mistake is
 * corrected by recording a reversing handover, which is why `reversesHandover` points
 * **forward** — the row being undone is never written to (research.md §9).
 *
 * Every handover hangs off a real `Order`, express sales included, so there is one code path
 * rather than two (research.md §8).
 */
@Entity({ tableName: 'handover' })
export class Handover {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => Order, { fieldName: 'orderId' })
  @Index()
  order!: Rel<Order>

  /** Denormalised from `order.member` so a member's handover history is one query. */
  @ManyToOne(() => Member, { fieldName: 'memberId' })
  @Index()
  member!: Rel<Member>

  /** Sum of its lines. Negative on a reversal. */
  @Property()
  totalAmountCents!: number

  @Property()
  currency: string = 'EUR'

  @Property()
  kind: HandoverKind = 'handover'

  /**
   * Set only when `kind = 'reversal'`. "Has this handover been reversed?" is answered by
   * `EXISTS(WHERE reversesHandover = :id)`, never by a flag on the original.
   */
  @ManyToOne(() => Handover, { fieldName: 'reversesHandoverId', nullable: true })
  @Index()
  reversesHandover?: Rel<Handover>

  /** Who was at the table (FR-029). */
  @ManyToOne(() => User, { fieldName: 'recordedByUserId' })
  recordedByUser!: Rel<User>

  /** The reason given for a reversal. Sized to the 500 characters the contract accepts. */
  @Property({ length: 500, nullable: true })
  note?: string

  @OneToMany(() => HandoverLine, (line) => line.handover)
  lines = new Collection<HandoverLine>(this)

  @Property()
  createdAt: Date = new Date()
}
