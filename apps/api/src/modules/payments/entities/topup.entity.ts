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
import { WalletEntry } from '../../wallet/entities/wallet-entry.entity'
import type { TopupStatus } from '../contracts/topup.contract'

/**
 * One online top-up, from the payment request to its outcome. A state record, not a ledger: its
 * status changes. The ledger rule still holds because the only money write is a new
 * `WalletEntry` row, linked here once the payment is confirmed.
 */
@Entity({ tableName: 'topup' })
@Index({ properties: ['status', 'createdAt'] })
export class Topup {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => Member, { fieldName: 'memberId' })
  @Index()
  member!: Rel<Member>

  /** The requested amount. A successful payment credits exactly this, never the paid amount. */
  @Property()
  amountCents!: number

  @Property()
  currency: string = 'EUR'

  @Property()
  status: TopupStatus = 'pending'

  /** The provider's id for the request. Set right after the provider creates it. */
  @Property({ nullable: true })
  @Unique()
  providerRequestId?: string

  /** Kept so a page reload can resume, and for support. */
  @Property({ type: 'text', nullable: true })
  redirectUrl?: string

  @Property()
  expiresAt!: Date

  /** Set only when paid. Unique, so one provider payment can never be credited twice. */
  @Property({ nullable: true })
  @Unique()
  providerPaymentId?: string

  @ManyToOne(() => WalletEntry, { fieldName: 'walletEntryId', nullable: true })
  @Unique()
  walletEntry?: Rel<WalletEntry>

  @Property({ nullable: true })
  paidAt?: Date

  /** When the provider was last asked about this top-up. */
  @Property({ nullable: true })
  lastCheckedAt?: Date

  /**
   * Set once, the first time the provider says the payer paid less than the requested amount and
   * the admins are told. It is set before the mail is sent, so the mail goes out at most once.
   * Never cleared.
   */
  @Property({ nullable: true })
  underpaidNotifiedAt?: Date

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
