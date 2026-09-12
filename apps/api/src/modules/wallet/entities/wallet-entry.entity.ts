import type { Rel } from '@mikro-orm/core'
import { Entity, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'
import type { PaymentMethod, WalletEntryReason } from '../contracts/wallet.contract'
import { User } from '../../auth/auth.entity'
import { Handover } from '../../distribution/entities/handover.entity'
import { Member } from '../../members/entities/member.entity'

/**
 * The only source of truth for a member's balance (Principle II). An append-only ledger row:
 * `createdAt` only, never edited, never deleted. A mistake is corrected by writing another
 * row, never by touching this one.
 *
 * Derived per member, never stored:
 * - balance (cents) = SUM(amountCents), `0` when the member has no rows
 *
 * `amountCents` is signed: negative charges the member, positive credits them. One signed
 * column rather than two tables makes the balance a single SUM and states the immutability
 * rule once (research.md §3).
 */
@Entity({ tableName: 'walletEntry' })
export class WalletEntry {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => Member, { fieldName: 'memberId' })
  @Index()
  member!: Rel<Member>

  /** Negative = charged to the member, positive = credited. Never zero. */
  @Property()
  amountCents!: number

  @Property()
  currency: string = 'EUR'

  @Property()
  reason!: WalletEntryReason

  /** Set only on `payment_received`; null on both handover reasons. */
  @Property({ nullable: true })
  paymentMethod?: PaymentMethod

  /**
   * Traces the movement back to its source (SC-002). Set on `handover_charge` and
   * `handover_reversal`, null on `payment_received`.
   */
  @ManyToOne(() => Handover, { fieldName: 'handoverId', nullable: true })
  @Index()
  handover?: Rel<Handover>

  /** The staff member who validated the handover or entered the payment. */
  @ManyToOne(() => User, { fieldName: 'recordedByUserId', nullable: true })
  recordedByUser?: Rel<User>

  /** Free text: the reason given for a reversal (FR-029), or a cheque number. */
  @Property({ nullable: true })
  note?: string

  @Property()
  createdAt: Date = new Date()
}
