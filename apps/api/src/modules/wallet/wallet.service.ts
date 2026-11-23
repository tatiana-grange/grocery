import {
  EntityManager,
  LockMode,
  QueryOrder,
  UniqueConstraintViolationException,
} from '@mikro-orm/core'
import { ConflictException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common'
import { User } from '../auth/auth.entity'
import { Handover } from '../distribution/entities/handover.entity'
import { Member } from '../members/entities/member.entity'
import type {
  CorrectPaymentInput,
  ManualPaymentMethod,
  PaymentCorrectionRefusal,
  PaymentMethod,
  RefundRefusal,
  WalletEntryReason,
} from './contracts/wallet.contract'
import { WalletEntry } from './entities/wallet-entry.entity'

/** One row of the balance query. Postgres returns `sum()` as a string, or null for no rows. */
interface BalanceRow {
  balanceCents: string | null
}

export interface WalletWriteInput {
  memberId: string
  /** Positive magnitude. `charge` stores it negated; `credit` stores it as-is. */
  amountCents: number
  reason: WalletEntryReason
  handover?: Handover
  recordedByUserId?: string
  paymentMethod?: PaymentMethod
  note?: string
  /** Set only by a verified online payment. */
  providerPaymentId?: string
  /** Set only by a payment correction: the `payment_received` row it reverses. */
  correctsEntry?: WalletEntry
}

export interface RefundWriteInput {
  amountCents: number
  paymentMethod: ManualPaymentMethod
  reason: string
}

export interface CorrectionResult {
  entry: WalletEntry
  balanceAfterCents: number
}

@Injectable()
export class WalletService {
  constructor(private readonly em: EntityManager) {}

  /** The ambient request EntityManager, for callers reading outside a transaction. */
  get entityManager(): EntityManager {
    return this.em
  }

  /**
   * A member's balance, in cents. Always `SUM(amountCents)` over their entries — there is no
   * stored balance anywhere, by Principle II.
   *
   * Takes an `EntityManager` explicitly so a caller inside a transaction reads its own
   * uncommitted writes and, more importantly, reads under the same member row lock that
   * protects the counter's balance check from two tills validating at once (research.md §4). The sum is done by the database for
   * the same reason `InventoryService.getStockLevels` does it: the ledger only grows, and a
   * screen needs one number.
   */
  async getBalanceCents(em: EntityManager, memberId: string): Promise<number> {
    // The transaction context matters twice over. It keeps the read on the transaction's own
    // connection — without it the query waits for a second one, which under a pool of one is
    // a deadlock — and it is what makes the sum include rows this transaction has written but
    // not yet committed.
    const rows: BalanceRow[] = await em
      .getConnection()
      .execute(
        'select sum("amountCents") as "balanceCents" from "walletEntry" where "memberId" = ?',
        [memberId],
        'all',
        em.getTransactionContext(),
      )
    return Number(rows[0]?.balanceCents ?? 0)
  }

  /** Appends one negative entry. Never called outside a transaction that already checked the balance. */
  charge(em: EntityManager, input: WalletWriteInput): WalletEntry {
    return this.append(em, input, -Math.abs(input.amountCents))
  }

  /** Appends one positive entry — money received, or a handover being put back. */
  credit(em: EntityManager, input: WalletWriteInput): WalletEntry {
    return this.append(em, input, Math.abs(input.amountCents))
  }

  private append(em: EntityManager, input: WalletWriteInput, signedCents: number): WalletEntry {
    const entry = new WalletEntry()
    entry.member = em.getReference(Member, input.memberId)
    entry.amountCents = signedCents
    entry.currency = 'EUR'
    entry.reason = input.reason
    entry.paymentMethod = input.paymentMethod
    entry.handover = input.handover
    entry.recordedByUser = input.recordedByUserId
      ? em.getReference(User, input.recordedByUserId)
      : undefined
    entry.note = input.note
    entry.providerPaymentId = input.providerPaymentId
    entry.correctsEntry = input.correctsEntry
    em.persist(entry)
    return entry
  }

  /**
   * Records money a member has actually handed over (FR-026). One positive entry carrying the
   * amount, the means it was paid by, and who took it.
   *
   * No lock and no transaction of its own: a credit alone can never lower a balance, so there
   * is nothing here that two concurrent calls could break. Taking money back is a different
   * path, `correctPayment`, and it can leave a balance below zero.
   */
  async recordPayment(
    memberId: string,
    input: { amountCents: number; paymentMethod: PaymentMethod; note?: string },
    recordedByUserId: string,
  ): Promise<WalletEntry> {
    const member = await this.getMember(memberId)
    const entry = this.credit(this.em, {
      memberId: member.id,
      amountCents: input.amountCents,
      reason: 'payment_received',
      paymentMethod: input.paymentMethod,
      note: input.note,
      recordedByUserId,
    })
    await this.em.flush()
    return entry
  }

  /**
   * Reverses a payment staff recorded by mistake. Appends one `payment_correction` row of the
   * opposite amount that points at the original, which is never touched. It does not check the
   * balance: it may leave the member below zero, which blocks their purchases until they top up.
   *
   * Only a `payment_received` row can be corrected, and only once (the unique index on
   * `correctsEntry` is the backstop for two staff members clicking at the same moment). No
   * member row lock: there is no balance rule to protect here, and a handover landing at the
   * same moment sees the balance before or after, both legal.
   */
  async correctPayment(
    memberId: string,
    entryId: string,
    input: CorrectPaymentInput,
    staffUserId: string,
  ): Promise<CorrectionResult> {
    try {
      return await this.em.transactional(async (tem) => {
        const member = await tem.findOne(Member, { id: memberId })
        if (!member) throw new NotFoundException('Member not found')
        const original = await tem.findOne(WalletEntry, { id: entryId, member: memberId })
        if (!original) throw new NotFoundException('Entry not found')
        if (original.reason !== 'payment_received') {
          throw this.refuse(
            'not_a_manual_payment',
            'Only a payment recorded by staff can be corrected',
          )
        }
        if (await tem.count(WalletEntry, { correctsEntry: original.id })) {
          throw this.refuse('already_corrected', 'This payment was already corrected')
        }
        const entry = this.charge(tem, {
          memberId,
          amountCents: original.amountCents,
          reason: 'payment_correction',
          paymentMethod: original.paymentMethod,
          note: input.reason,
          recordedByUserId: staffUserId,
          correctsEntry: original,
        })
        await tem.flush()
        return { entry, balanceAfterCents: await this.getBalanceCents(tem, memberId) }
      })
    } catch (error) {
      if (error instanceof UniqueConstraintViolationException) {
        throw this.refuse('already_corrected', 'This payment was already corrected')
      }
      throw error
    }
  }

  /**
   * Records money the cooperative gave back to a member by hand. One negative `refund` row with
   * the method, the reason (as the note) and the admin. Nothing is sent anywhere: this service
   * knows nothing of the payment provider.
   *
   * It never takes the balance below zero. The member row is locked, the balance is read and the
   * row is written in one transaction, so two refunds at the same moment cannot both pass. A
   * balance of zero or below refuses every refund. A correction takes no member lock and may
   * land after the check; it can only lower the balance, which a correction is allowed to do.
   */
  async refund(
    memberId: string,
    input: RefundWriteInput,
    adminUserId: string,
  ): Promise<WalletEntry> {
    return this.em.transactional(async (tem) => {
      const member = await tem.findOne(
        Member,
        { id: memberId },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      )
      if (!member) throw new NotFoundException('Member not found')
      const balanceCents = await this.getBalanceCents(tem, memberId)
      if (balanceCents <= 0 || input.amountCents > balanceCents) {
        throw new ConflictException({
          statusCode: HttpStatus.CONFLICT,
          message: 'A refund cannot be larger than the balance',
          code: 'refund_exceeds_balance' satisfies RefundRefusal,
          balanceEur: balanceCents / 100,
          amountEur: input.amountCents / 100,
        })
      }
      const entry = this.charge(tem, {
        memberId,
        amountCents: input.amountCents,
        reason: 'refund',
        paymentMethod: input.paymentMethod,
        note: input.reason,
        recordedByUserId: adminUserId,
      })
      await tem.flush()
      return entry
    })
  }

  /**
   * A page of the member's movements, newest first. `correctedBy` maps each corrected payment
   * of this page to its correction row; it is read by the ids of the page, so a correction
   * that sits on a newer page still shows.
   */
  async listEntries(
    memberId: string,
    pagination: { pageSize: number; offset: number },
  ): Promise<{ items: WalletEntry[]; total: number; correctedBy: Map<string, string> }> {
    const [items, total] = await this.em.findAndCount(
      WalletEntry,
      { member: memberId },
      {
        orderBy: { createdAt: QueryOrder.DESC },
        limit: pagination.pageSize,
        offset: pagination.offset,
        populate: ['recordedByUser'],
      },
    )
    const corrections = items.length
      ? await this.em.find(WalletEntry, { correctsEntry: { $in: items.map((item) => item.id) } })
      : []
    const correctedBy = new Map<string, string>()
    for (const correction of corrections) {
      if (correction.correctsEntry) correctedBy.set(correction.correctsEntry.id, correction.id)
    }
    return { items, total, correctedBy }
  }

  async getMember(memberId: string): Promise<Member> {
    const member = await this.em.findOne(Member, { id: memberId }, { populate: ['user'] })
    if (!member) throw new NotFoundException('Member not found')
    return member
  }

  async getMemberForUser(userId: string): Promise<Member> {
    const member = await this.em.findOne(Member, { user: userId }, { populate: ['user'] })
    if (!member) throw new NotFoundException('Member not found')
    return member
  }

  /** Same refusal shape as the distribution module, so the client reads the code the same way. */
  private refuse(code: PaymentCorrectionRefusal, message: string) {
    return new ConflictException({ statusCode: HttpStatus.CONFLICT, message, code })
  }
}
