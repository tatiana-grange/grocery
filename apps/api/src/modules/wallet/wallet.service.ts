import { EntityManager, QueryOrder } from '@mikro-orm/core'
import { Injectable, NotFoundException } from '@nestjs/common'
import { User } from '../auth/auth.entity'
import { Handover } from '../distribution/entities/handover.entity'
import { Member } from '../members/entities/member.entity'
import type { PaymentMethod, WalletEntryReason } from './contracts/wallet.contract'
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
}

@Injectable()
export class WalletService {
  constructor(private readonly em: EntityManager) {}

  /**
   * A member's balance, in cents. Always `SUM(amountCents)` over their entries — there is no
   * stored balance anywhere, by Principle II.
   *
   * Takes an `EntityManager` explicitly so a caller inside a transaction reads its own
   * uncommitted writes and, more importantly, reads under the same member row lock that
   * makes the non-negative rule hold (research.md §4). The sum is done by the database for
   * the same reason `InventoryService.getStockLevels` does it: the ledger only grows, and a
   * screen needs one number.
   */
  async getBalanceCents(em: EntityManager, memberId: string): Promise<number> {
    const rows: BalanceRow[] = await em
      .getConnection()
      .execute(
        'select sum("amountCents") as "balanceCents" from "walletEntry" where "memberId" = ?',
        [memberId],
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
    em.persist(entry)
    return entry
  }

  /** A page of the member's movements, newest first. */
  async listEntries(
    memberId: string,
    pagination: { pageSize: number; offset: number },
  ): Promise<{ items: WalletEntry[]; total: number }> {
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
    return { items, total }
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
}
