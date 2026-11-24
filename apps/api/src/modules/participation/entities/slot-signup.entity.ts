import type { Rel } from '@mikro-orm/core'
import {
  Entity,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy'
import { Member } from '../../members/entities/member.entity'
import { Slot } from './slot.entity'

/**
 * One member holding one place on one slot. The row is deleted when the member leaves or is
 * removed, so no history is kept. The unique pair is the backstop for the one-sign-up rule.
 */
@Entity({ tableName: 'slotSignup' })
@Unique({ properties: ['slot', 'member'] })
export class SlotSignup {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => Slot, { fieldName: 'slotId' })
  @Index()
  slot!: Rel<Slot>

  @ManyToOne(() => Member, { fieldName: 'memberId' })
  @Index()
  member!: Rel<Member>

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
