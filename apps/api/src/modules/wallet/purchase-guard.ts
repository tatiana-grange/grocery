import type { EntityManager } from '@mikro-orm/core'
import { Injectable } from '@nestjs/common'
import { refusal } from '../../common/refusal'
import { centsToEur } from '../catalog/catalog.util'
import type { PurchaseRefusal } from './contracts/wallet.contract'
import { WalletService } from './wallet.service'

/** A member is blocked exactly while the sum of their ledger is below zero. Nothing is stored. */
export function isBlocked(balanceCents: number): boolean {
  return balanceCents < 0
}

/**
 * Whether the balance covers a counter purchase (FR-027).
 *
 * The comparison is deliberately `<=`: a total that exactly equals the balance is allowed.
 * Spending your last euro is not an overdraft.
 */
export function balanceCovers(totalCents: number, balanceCents: number): boolean {
  return totalCents <= balanceCents
}

/**
 * The one place that decides to refuse a purchase for a balance reason. The counter (handover
 * and express order) and the online shop (cart and checkout) all call it, so the rule has one
 * definition. A top-up or a new payment that brings the sum back to zero or above lifts the
 * block with no other action.
 */
@Injectable()
export class PurchaseGuard {
  constructor(private readonly wallet: WalletService) {}

  /**
   * Counter. Reads the balance, refuses, and returns the balance so the caller reuses it.
   * The shortfall is total minus balance, so it includes what a negative balance owes.
   */
  async assertCounterPurchase(
    em: EntityManager,
    memberId: string,
    totalCents: number,
  ): Promise<number> {
    const balanceCents = await this.wallet.getBalanceCents(em, memberId)
    if (isBlocked(balanceCents) || !balanceCovers(totalCents, balanceCents)) {
      throw refusal(
        'insufficient_balance' satisfies PurchaseRefusal,
        'This member’s balance does not cover it',
        {
          shortfallEur: centsToEur(totalCents - balanceCents),
          balanceEur: centsToEur(balanceCents),
          totalEur: centsToEur(totalCents),
        },
      )
    }
    return balanceCents
  }

  /** Online. Only a negative balance blocks. Exactly zero passes. */
  async assertOnlinePurchase(em: EntityManager, memberId: string): Promise<void> {
    const balanceCents = await this.wallet.getBalanceCents(em, memberId)
    if (isBlocked(balanceCents)) {
      throw refusal(
        'negative_balance' satisfies PurchaseRefusal,
        'This account has a negative balance',
        {
          balanceEur: centsToEur(balanceCents),
        },
      )
    }
  }
}
