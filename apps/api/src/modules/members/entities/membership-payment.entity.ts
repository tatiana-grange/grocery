import type {
  MembershipPaymentKind,
  MembershipPaymentMethod,
} from '../contracts/member.contract'
import type { Rel } from '@mikro-orm/core'
import { Entity, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'
import { User } from '../../auth/auth.entity'
import { MembershipFee } from './membership-fee.entity'

/**
 * Append-only. A `payment` has a positive amount; a correction is an `adjustment` row with any
 * non-zero amount. Rows are never edited or deleted.
 */
@Entity({ tableName: 'membershipPayment' })
export class MembershipPayment {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => MembershipFee, { fieldName: 'feeId' })
  @Index()
  fee!: Rel<MembershipFee>

  @Property()
  kind: MembershipPaymentKind = 'payment'

  @Property()
  amountCents!: number

  @Property()
  method!: MembershipPaymentMethod

  @Property()
  paidAt!: Date

  @Property({ nullable: true })
  note?: string

  @ManyToOne(() => User, { fieldName: 'recordedByUserId' })
  recordedByUser!: User

  @Property()
  createdAt: Date = new Date()
}
