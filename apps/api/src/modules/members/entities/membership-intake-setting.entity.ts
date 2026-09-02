import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'

/**
 * Single-row settings record controlling whether self-registration is currently accepted.
 * The row is created on first read with `open = true`.
 */
@Entity({ tableName: 'membershipIntakeSetting' })
export class MembershipIntakeSetting {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property()
  open: boolean = true

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
