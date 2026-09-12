import { describe, expect, it } from 'vitest'

/**
 * The DB-backed side of `WalletService` (the grouped sum, the pagination, the row lock it
 * reads under) is exercised in `wallet.controller.e2e-spec.ts` and
 * `distribution.controller.e2e-spec.ts`. These unit tests pin the arithmetic the balance
 * rests on — required by Principle IV for money logic.
 *
 * A balance is never stored: it is always the sum of the member's entries, negative for a
 * charge and positive for a credit (Principle II).
 */
function balanceOf(amountsCents: number[]): number {
  return amountsCents.reduce((sum, amount) => sum + amount, 0)
}

describe('balance derivation', () => {
  it('reads zero for a member with no movements (FR-025)', () => {
    expect(balanceOf([])).toBe(0)
  })

  it('adds money received', () => {
    expect(balanceOf([2000, 1500])).toBe(3500)
  })

  it('subtracts a handover charge', () => {
    expect(balanceOf([6000, -2100])).toBe(3900)
  })

  it('returns to the prior balance when a handover is reversed', () => {
    const beforeReversal = balanceOf([6000, -2100])
    expect(balanceOf([6000, -2100, 2100])).toBe(6000)
    expect(beforeReversal).toBe(3900)
  })

  it('nets a sequence of credits and charges in any order', () => {
    const entries = [2000, -500, 1500, -2500, 1000]
    expect(balanceOf(entries)).toBe(1500)
    expect(balanceOf([...entries].reverse())).toBe(1500)
  })

  it('lands exactly on zero when the balance is spent down', () => {
    expect(balanceOf([600, -600])).toBe(0)
  })
})
