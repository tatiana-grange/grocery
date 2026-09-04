import type { MemberStatus } from '../contracts/member.contract'
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
import { User } from '../../auth/auth.entity'
import { MemberStatusChange } from './member-status-change.entity'

@Entity({ tableName: 'member' })
export class Member {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  /** One-to-one with the auth user: a member and an account are the same person. */
  @ManyToOne(() => User, { fieldName: 'userId' })
  @Unique()
  @Index()
  user!: Rel<User>

  @Property()
  @Unique()
  @Index()
  membershipNumber!: string

  @Property()
  status: MemberStatus = 'pending'

  @Property({ nullable: true })
  addressLine1?: string

  @Property({ nullable: true })
  addressLine2?: string

  @Property({ nullable: true })
  postalCode?: string

  @Property({ nullable: true })
  city?: string

  @Property({ nullable: true })
  phone?: string

  @Property({ nullable: true })
  joinedAt?: Date

  @OneToMany(() => MemberStatusChange, (change) => change.member)
  statusChanges = new Collection<MemberStatusChange>(this)

  /** Optimistic lock — clients send the version they loaded, a stale write returns 409. */
  @Property({ version: true })
  version!: number

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
