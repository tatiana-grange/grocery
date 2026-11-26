import type {
  MonthWeek,
  ScheduleFrequency,
  SupplierDeliveryMode,
  SupplierType,
  WeekParity,
} from '../contracts/supplier.contract'
import type { Rel } from '@mikro-orm/core'
import { Collection } from '@mikro-orm/core'
import {
  Entity,
  Index,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy'
import { ProducerCategory } from './producer-category.entity'
import { Product } from './product.entity'
import { Referent } from './referent.entity'

@Entity({ tableName: 'supplier' })
export class Supplier {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property()
  @Index()
  name!: string

  @Property()
  type: SupplierType = 'producer'

  @Property({ nullable: true })
  contactName?: string

  @Property({ nullable: true })
  contactEmail?: string

  @Property({ nullable: true })
  contactPhone?: string

  @Property({ nullable: true })
  notes?: string

  /** How goods move from this supplier to the épicerie. Unset until someone picks one. */
  @Property({ nullable: true })
  deliveryMode?: SupplierDeliveryMode

  /** The automatic sending schedule is on. The other `schedule*` columns keep their values when off. */
  @Property({ default: false })
  scheduleEnabled: boolean = false

  @Property({ type: 'text', nullable: true })
  scheduleFrequency?: ScheduleFrequency

  @Property({ type: 'text', nullable: true })
  scheduleWeekParity?: WeekParity

  @Property({ type: 'text', nullable: true })
  scheduleMonthWeek?: MonthWeek

  /** ISO weekday of the distribution, 1 Monday … 7 Sunday. */
  @Property({ type: 'smallint', nullable: true })
  scheduleDistributionWeekday?: number

  /** ISO weekday of the sending. */
  @Property({ type: 'smallint', nullable: true })
  scheduleSendingWeekday?: number

  /** Whole hour of the sending, Paris time, 0 to 23. */
  @Property({ type: 'smallint', nullable: true })
  scheduleSendingHour?: number

  /** Set when the schedule is switched on or its rule changes: earlier moments are ignored. */
  @Property({ nullable: true })
  scheduleActiveSince?: Date

  /** The last distribution day (`YYYY-MM-DD`) the automatic run handled. Never written by the form. */
  @Property({ type: 'date', nullable: true })
  scheduleHandledDay?: string

  @ManyToOne(() => Referent, { fieldName: 'referentId', nullable: true })
  @Index()
  referent?: Rel<Referent>

  @ManyToMany(() => ProducerCategory, (category) => category.suppliers, {
    owner: true,
    pivotTable: 'supplierProducerCategory',
  })
  producerCategories = new Collection<ProducerCategory>(this)

  @Property({ nullable: true })
  @Index()
  archivedAt?: Date

  @OneToMany(() => Product, (product) => product.supplier)
  products = new Collection<Product>(this)

  @Property({ version: true })
  version!: number

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
