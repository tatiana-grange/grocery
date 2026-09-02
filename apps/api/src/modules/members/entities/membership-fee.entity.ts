import type { Rel } from '@mikro-orm/core'
import { Collection } from '@mikro-orm/core'
import {
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy'
import { Member } from './member.entity'
import { MembershipPayment } from './membership-payment.entity'

/**
 * One row per member. `expectedAmountCents` seeds from MEMBERSHIP_FEE_DEFAULT_CENTS and can be
 * overridden per member (the "variable fee"). The paid amount and state are derived from the
 * append-only payment rows, never stored here.
 */
@Entity({ tableName: 'membershipFee' })
export class MembershipFee {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => Member, { fieldName: 'memberId' })
  @Unique()
  member!: Rel<Member>

  @Property()
  expectedAmountCents: number = 0

  @OneToMany(() => MembershipPayment, (payment) => payment.fee)
  payments = new Collection<MembershipPayment>(this)

  @Property({ version: true })
  version!: number

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
