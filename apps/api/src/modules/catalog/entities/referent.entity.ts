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
import { User } from '../../auth/auth.entity'
import { Supplier } from './supplier.entity'

/** The co-op member who follows a supplier — MonÉpi calls this the "référent". */
@Entity({ tableName: 'referent' })
export class Referent {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ nullable: true })
  firstName?: string

  @Property()
  @Index()
  lastName!: string

  @Property({ nullable: true })
  contactEmail?: string

  @Property({ nullable: true })
  contactPhone?: string

  /** Optional link to the referent's own account. Not every referent has one. */
  @ManyToOne(() => User, { fieldName: 'userId', nullable: true })
  user?: Rel<User>

  @OneToMany(() => Supplier, (supplier) => supplier.referent)
  suppliers = new Collection<Supplier>(this)

  @Property({ version: true })
  version!: number

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
