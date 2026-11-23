import type { EntityManager, MikroORM } from '@mikro-orm/core'
import { NotFoundException } from '@nestjs/common'
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest'
import { cleanupTestOrm, createTestOrm } from '../../../test/helpers/test-db.helper'
import { Member } from '../../members/entities/member.entity'
import { createMemberData } from '../../members/members.factory'
import type { WalletEntryReason } from '../contracts/wallet.contract'
import { WalletEntry } from '../entities/wallet-entry.entity'
import { WalletService } from '../wallet.service'

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

describe('WalletService.correctPayment', () => {
  let orm: MikroORM
  let em: EntityManager
  let service: WalletService
  let staffUserId: string
  let memberId: string

  beforeEach(async () => {
    orm = (await createTestOrm(inject('pgConfig'))).orm
    em = orm.em.fork()
    service = new WalletService(em)
    const staff = await createMemberData(em, {
      user: {
        name: 'Sam Staff',
        email: `staff-${Math.random().toString(36).slice(2)}@example.com`,
      },
      roles: ['member', 'distributor'],
      status: 'active',
    })
    staffUserId = staff.user.id
    const member = await createMemberData(em, {
      user: { name: 'Mia Member', email: `mia-${Math.random().toString(36).slice(2)}@example.com` },
      status: 'active',
    })
    memberId = member.member.id
  })

  afterEach(async () => {
    await cleanupTestOrm(orm)
  })

  const rows = () =>
    em.fork().find(WalletEntry, { member: memberId }, { orderBy: { createdAt: 'asc' } })
  const balance = () => new WalletService(em.fork()).getBalanceCents(em.fork(), memberId)

  async function pay(amountEur = 10, method: 'cash' | 'cheque' | 'transfer' = 'cash') {
    return service.recordPayment(
      memberId,
      { amountCents: Math.round(amountEur * 100), paymentMethod: method },
      staffUserId,
    )
  }

  async function seed(reason: WalletEntryReason, amountCents: number) {
    const entry = new WalletEntry()
    entry.member = em.getReference(Member, memberId)
    entry.amountCents = amountCents
    entry.reason = reason
    em.persist(entry)
    await em.flush()
    return entry
  }

  it('writes a reversing entry of the same amount that points at the original', async () => {
    const payment = await pay(10, 'cheque')

    const { entry, balanceAfterCents } = await service.correctPayment(
      memberId,
      payment.id,
      { reason: 'Cheque bounced' },
      staffUserId,
    )

    expect(entry.reason).toBe('payment_correction')
    expect(entry.amountCents).toBe(-1000)
    expect(entry.correctsEntry?.id).toBe(payment.id)
    expect(balanceAfterCents).toBe(0)
    expect(await rows()).toHaveLength(2)
  })

  it('leaves the original row unchanged and the only row pointing nowhere', async () => {
    const payment = await pay(10)
    const before = { ...(await rows())[0] }

    await service.correctPayment(memberId, payment.id, { reason: 'Mistake' }, staffUserId)

    const [original, correction] = await rows()
    expect(original?.id).toBe(payment.id)
    expect(original?.amountCents).toBe(before.amountCents)
    expect(original?.reason).toBe('payment_received')
    expect(original?.note).toBe(before.note)
    expect(original?.createdAt).toEqual(before.createdAt)
    expect(original?.correctsEntry ?? null).toBeNull()
    expect(correction?.correctsEntry?.id).toBe(payment.id)
  })

  it('records the method, the staff user and the reason as the note', async () => {
    const payment = await pay(12.5, 'transfer')

    const { entry } = await service.correctPayment(
      memberId,
      payment.id,
      { reason: 'Wrong member' },
      staffUserId,
    )

    expect(entry.paymentMethod).toBe('transfer')
    expect(entry.recordedByUser?.id).toBe(staffUserId)
    expect(entry.note).toBe('Wrong member')
  })

  it('leaves a negative balance and still succeeds', async () => {
    const payment = await pay(10)
    await seed('handover_charge', -800)

    const { balanceAfterCents } = await service.correctPayment(
      memberId,
      payment.id,
      { reason: 'Mistake' },
      staffUserId,
    )

    expect(balanceAfterCents).toBe(-800)
    expect(await balance()).toBe(-800)
  })

  it.each([
    ['online_topup', 2000],
    ['handover_charge', -500],
    ['handover_reversal', 500],
  ] as const)('refuses a %s row with not_a_manual_payment', async (reason, amountCents) => {
    const entry = await seed(reason, amountCents)

    await expect(
      service.correctPayment(memberId, entry.id, { reason: 'Mistake' }, staffUserId),
    ).rejects.toMatchObject({ status: 409, response: { code: 'not_a_manual_payment' } })
    expect(await rows()).toHaveLength(1)
  })

  it('refuses to correct a correction with not_a_manual_payment', async () => {
    const payment = await pay(10)
    const { entry } = await service.correctPayment(
      memberId,
      payment.id,
      { reason: 'x' },
      staffUserId,
    )

    await expect(
      service.correctPayment(memberId, entry.id, { reason: 'again' }, staffUserId),
    ).rejects.toMatchObject({ status: 409, response: { code: 'not_a_manual_payment' } })
  })

  it('refuses a second correction of the same payment with already_corrected', async () => {
    const payment = await pay(10)
    await service.correctPayment(memberId, payment.id, { reason: 'x' }, staffUserId)

    await expect(
      service.correctPayment(memberId, payment.id, { reason: 'y' }, staffUserId),
    ).rejects.toMatchObject({ status: 409, response: { code: 'already_corrected' } })
    expect(await rows()).toHaveLength(2)
  })

  it('answers 404 for an entry that belongs to another member', async () => {
    const payment = await pay(10)
    const other = await createMemberData(em, {
      user: {
        name: 'Olga Other',
        email: `olga-${Math.random().toString(36).slice(2)}@example.com`,
      },
      status: 'active',
    })

    await expect(
      service.correctPayment(other.member.id, payment.id, { reason: 'x' }, staffUserId),
    ).rejects.toBeInstanceOf(NotFoundException)
    expect(await rows()).toHaveLength(1)
  })

  it('lets one of two simultaneous corrections win and refuses the other', async () => {
    const payment = await pay(10)
    const other = new WalletService(orm.em.fork())

    const results = await Promise.allSettled([
      service.correctPayment(memberId, payment.id, { reason: 'a' }, staffUserId),
      other.correctPayment(memberId, payment.id, { reason: 'b' }, staffUserId),
    ])

    const failed = results.filter((r) => r.status === 'rejected')
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(failed).toHaveLength(1)
    expect((failed[0] as PromiseRejectedResult).reason).toMatchObject({
      status: 409,
      response: { code: 'already_corrected' },
    })
    expect(await rows()).toHaveLength(2)
  })

  it('never updates or deletes a row: the original reads the same after', async () => {
    const payment = await pay(10)
    const snapshot = JSON.stringify((await rows())[0])

    await service.correctPayment(memberId, payment.id, { reason: 'x' }, staffUserId)

    expect(JSON.stringify((await rows())[0])).toBe(snapshot)
  })
})

describe('WalletService.refund', () => {
  let orm: MikroORM
  let em: EntityManager
  let service: WalletService
  let adminUserId: string
  let memberId: string

  beforeEach(async () => {
    orm = (await createTestOrm(inject('pgConfig'))).orm
    em = orm.em.fork()
    service = new WalletService(em)
    const admin = await createMemberData(em, {
      user: { name: 'Ada Admin', email: `ada-${Math.random().toString(36).slice(2)}@example.com` },
      roles: ['member', 'admin'],
      status: 'active',
    })
    adminUserId = admin.user.id
    const member = await createMemberData(em, {
      user: { name: 'Mia Member', email: `mia-${Math.random().toString(36).slice(2)}@example.com` },
      status: 'active',
    })
    memberId = member.member.id
  })

  afterEach(async () => {
    await cleanupTestOrm(orm)
  })

  const rows = () =>
    em.fork().find(WalletEntry, { member: memberId }, { orderBy: { createdAt: 'asc' } })
  const balance = () => new WalletService(em.fork()).getBalanceCents(em.fork(), memberId)

  async function pay(amountEur: number) {
    return service.recordPayment(
      memberId,
      { amountCents: Math.round(amountEur * 100), paymentMethod: 'cash' },
      adminUserId,
    )
  }

  const refundInput = (amountCents: number) => ({
    amountCents,
    paymentMethod: 'cheque' as const,
    reason: 'Left the cooperative',
  })

  it('refund writes one negative entry with the method, the reason and the admin', async () => {
    await pay(30)

    const entry = await service.refund(memberId, refundInput(1000), adminUserId)

    expect(entry.reason).toBe('refund')
    expect(entry.amountCents).toBe(-1000)
    expect(entry.paymentMethod).toBe('cheque')
    expect(entry.note).toBe('Left the cooperative')
    expect(entry.recordedByUser?.id).toBe(adminUserId)
    expect(await rows()).toHaveLength(2)
  })

  it('lowers the balance by the amount', async () => {
    await pay(30)
    await service.refund(memberId, refundInput(1000), adminUserId)
    expect(await balance()).toBe(2000)
  })

  it('accepts a refund of exactly the balance and leaves zero', async () => {
    await pay(30)
    await service.refund(memberId, refundInput(3000), adminUserId)
    expect(await balance()).toBe(0)
  })

  it('refuses a refund above the balance and writes nothing', async () => {
    await pay(30)
    await expect(service.refund(memberId, refundInput(3001), adminUserId)).rejects.toMatchObject({
      status: 409,
      response: { code: 'refund_exceeds_balance', balanceEur: 30, amountEur: 30.01 },
    })
    expect(await rows()).toHaveLength(1)
  })

  it('refuses any refund on a balance of zero', async () => {
    await expect(service.refund(memberId, refundInput(100), adminUserId)).rejects.toMatchObject({
      status: 409,
      response: { code: 'refund_exceeds_balance' },
    })
    expect(await rows()).toHaveLength(0)
  })

  it('refuses any refund on a negative balance', async () => {
    const payment = await pay(10)
    await service.correctPayment(memberId, payment.id, { reason: 'x' }, adminUserId)
    const spent = new WalletEntry()
    spent.member = em.getReference(Member, memberId)
    spent.amountCents = -500
    spent.reason = 'handover_charge'
    em.persist(spent)
    await em.flush()

    await expect(service.refund(memberId, refundInput(100), adminUserId)).rejects.toMatchObject({
      status: 409,
      response: { code: 'refund_exceeds_balance' },
    })
  })

  it('answers 404 for an unknown member', async () => {
    await expect(
      service.refund('00000000-0000-4000-8000-000000000000', refundInput(100), adminUserId),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('lets one of two simultaneous refunds win when together they exceed the balance', async () => {
    await pay(30)
    const other = new WalletService(orm.em.fork())

    const results = await Promise.allSettled([
      service.refund(memberId, refundInput(2000), adminUserId),
      other.refund(memberId, refundInput(2000), adminUserId),
    ])

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1)
    expect(await balance()).toBe(1000)
  })

  it('leaves earlier rows unchanged', async () => {
    await pay(30)
    const snapshot = JSON.stringify((await rows())[0])
    await service.refund(memberId, refundInput(1000), adminUserId)
    expect(JSON.stringify((await rows())[0])).toBe(snapshot)
  })

  it('cannot be corrected: a correction of a refund is refused', async () => {
    await pay(30)
    const entry = await service.refund(memberId, refundInput(1000), adminUserId)
    await expect(
      service.correctPayment(memberId, entry.id, { reason: 'x' }, adminUserId),
    ).rejects.toMatchObject({ status: 409, response: { code: 'not_a_manual_payment' } })
  })
})
