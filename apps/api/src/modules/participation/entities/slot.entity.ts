import { Collection } from '@mikro-orm/core'
import { Entity, Index, OneToMany, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'
import { SlotSignup } from './slot-signup.entity'

/**
 * A stretch of time the cooperative needs people for, with a role label and a number of places.
 * "Ended" and "started" are never stored: they are read from the clock. `cancelledAt` is the one
 * state that is stored, set only by the admin cancel route and never reset.
 */
@Entity({ tableName: 'slot' })
export class Slot {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ length: 120 })
  roleLabel!: string

  @Property()
  @Index()
  startsAt!: Date

  @Property()
  endsAt!: Date

  @Property()
  places!: number

  @Property({ nullable: true })
  cancelledAt?: Date

  @OneToMany(() => SlotSignup, (signup) => signup.slot)
  signups = new Collection<SlotSignup>(this)

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
