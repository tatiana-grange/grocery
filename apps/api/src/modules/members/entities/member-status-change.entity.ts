import type { MemberStatus } from '../contracts/member.contract'
import type { Rel } from '@mikro-orm/core'
import { Entity, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'
import { User } from '../../auth/auth.entity'
import { Member } from './member.entity'

/**
 * Append-only history of a member's status. Never edited or deleted — every transition
 * writes one row in the same transaction as the status change.
 */
@Entity({ tableName: 'memberStatusChange' })
export class MemberStatusChange {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => Member, { fieldName: 'memberId' })
  @Index()
  member!: Rel<Member>

  @Property({ nullable: true })
  fromStatus?: MemberStatus

  @Property()
  toStatus!: MemberStatus

  @Property({ nullable: true })
  reason?: string

  /** The admin who made the change; null when the system or the member themselves did it. */
  @ManyToOne(() => User, { fieldName: 'changedByUserId', nullable: true })
  changedByUser?: User

  @Property()
  createdAt: Date = new Date()
}
