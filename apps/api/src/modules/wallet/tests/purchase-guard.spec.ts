import type { EntityManager } from '@mikro-orm/core'
import { describe, expect, it } from 'vitest'
import { balanceCovers, isBlocked, PurchaseGuard } from '../purchase-guard'
import type { WalletService } from '../wallet.service'

const em = {} as EntityManager

/** A wallet that answers one balance, whatever the member. */
function guardWithBalance(balanceCents: number) {
  const wallet = { getBalanceCents: async () => balanceCents } as unknown as WalletService
  return new PurchaseGuard(wallet)
}

describe('PurchaseGuard.assertCounterPurchase', () => {
  it('refuses a negative balance at the counter with insufficient_balance and a shortfall that includes the debt', async () => {
    const guard = guardWithBalance(-500)

    await expect(guard.assertCounterPurchase(em, 'member-1', 300)).rejects.toMatchObject({
      status: 409,
      response: {
        code: 'insufficient_balance',
        shortfallEur: 8,
        balanceEur: -5,
        totalEur: 3,
      },
    })
  })

  it('refuses a total one cent over the balance', async () => {
    await expect(
      guardWithBalance(6000).assertCounterPurchase(em, 'member-1', 6001),
    ).rejects.toMatchObject({ response: { code: 'insufficient_balance', shortfallEur: 0.01 } })
  })

  it('returns the balance when the purchase is allowed, so the caller reuses it', async () => {
    await expect(guardWithBalance(6000).assertCounterPurchase(em, 'member-1', 2100)).resolves.toBe(
      6000,
    )
  })

  it('lets a total equal to the balance through', async () => {
    await expect(guardWithBalance(6000).assertCounterPurchase(em, 'member-1', 6000)).resolves.toBe(
      6000,
    )
  })

  it('lets a zero total on a zero balance through', async () => {
    await expect(guardWithBalance(0).assertCounterPurchase(em, 'member-1', 0)).resolves.toBe(0)
  })
})

describe('PurchaseGuard.assertOnlinePurchase', () => {
  it('refuses a negative balance with negative_balance and the balance', async () => {
    await expect(guardWithBalance(-1).assertOnlinePurchase(em, 'member-1')).rejects.toMatchObject({
      status: 409,
      response: { code: 'negative_balance', balanceEur: -0.01 },
    })
  })

  it('lets exactly zero through', async () => {
    await expect(guardWithBalance(0).assertOnlinePurchase(em, 'member-1')).resolves.toBeUndefined()
  })

  it('lets a positive balance through', async () => {
    await expect(guardWithBalance(1).assertOnlinePurchase(em, 'member-1')).resolves.toBeUndefined()
  })
})

describe('isBlocked', () => {
  it.each([
    [-1, true],
    [0, false],
    [1, false],
  ])('is %s cents blocked: %s', (balanceCents, expected) => {
    expect(isBlocked(balanceCents)).toBe(expected)
  })
})

describe('balanceCovers', () => {
  it('allows a handover the balance covers', () => {
    expect(balanceCovers(2100, 6000)).toBe(true)
  })

  it('allows spending the balance down to exactly zero — that is not an overdraft', () => {
    expect(balanceCovers(6000, 6000)).toBe(true)
  })

  it('refuses a handover one cent over the balance (FR-027)', () => {
    expect(balanceCovers(6001, 6000)).toBe(false)
  })

  it('refuses anything at all on an empty account', () => {
    expect(balanceCovers(1, 0)).toBe(false)
    expect(balanceCovers(0, 0)).toBe(true)
  })
})
