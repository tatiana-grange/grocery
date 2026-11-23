import type { EntityManager, MikroORM } from '@mikro-orm/core'
import { Logger } from '@nestjs/common'
import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest'
import { cleanupTestOrm, createTestOrm } from '../../../test/helpers/test-db.helper'
import { Member } from '../../members/entities/member.entity'
import { createMemberData } from '../../members/members.factory'
import { WalletEntry } from '../../wallet/entities/wallet-entry.entity'
import { MemberNoticeService } from '../../wallet/member-notice.service'
import { WalletService } from '../../wallet/wallet.service'
import type { EmailService } from '../../email/email.service'
import { Topup } from '../entities/topup.entity'
import { PaymentsService } from '../payments.service'
import { DisabledPaymentProvider } from '../providers/disabled-payment.provider'
import { FakePaymentProvider } from '../providers/fake-payment.provider'
import { PaymentProviderError } from '../providers/payment-provider'

/** A notice service whose mail goes nowhere, for tests that do not look at mail. */
function noNotice(em: EntityManager): MemberNoticeService {
  return new MemberNoticeService(em, { sendEmail: async () => {} } as unknown as EmailService)
}

/**
 * `PaymentsService` against a real database and the in-memory fake provider. The unit project
 * has no database set up for it, so each test makes its own, as the e2e setup does.
 */
describe('PaymentsService.startTopup', () => {
  let orm: MikroORM
  let em: EntityManager
  let fake: FakePaymentProvider
  let service: PaymentsService
  let userId: string
  let memberId: string

  beforeEach(async () => {
    orm = (await createTestOrm(inject('pgConfig'))).orm
    em = orm.em.fork()
    fake = new FakePaymentProvider()
    service = new PaymentsService(em, fake, new WalletService(em), noNotice(em))
    const { user, member } = await createMemberData(em, {
      user: {
        name: 'Tess Topper',
        email: `tess-${Math.random().toString(36).slice(2)}@example.com`,
      },
      status: 'active',
    })
    userId = user.id
    memberId = member.id
  })

  afterEach(async () => {
    await cleanupTestOrm(orm)
  })

  const topups = () => em.fork().find(Topup, {})

  describe('amount bounds', () => {
    it.each([5, 200, 5.5, 12.34])('accepts %s euros', async (amountEur) => {
      const topup = await service.startTopup(userId, amountEur)

      expect(topup.status).toBe('pending')
      expect(topup.amountCents).toBe(Math.round(amountEur * 100))
    })

    it.each([4, 4.99, 0.5])(
      'refuses %s euros as too low, naming both bounds',
      async (amountEur) => {
        await expect(service.startTopup(userId, amountEur)).rejects.toMatchObject({
          response: { code: 'amount_too_low', minAmountEur: 5, maxAmountEur: 200 },
          status: 400,
        })
        expect(await topups()).toHaveLength(0)
      },
    )

    it.each([201, 200.01, 5000])(
      'refuses %s euros as too high, naming both bounds',
      async (amountEur) => {
        await expect(service.startTopup(userId, amountEur)).rejects.toMatchObject({
          response: { code: 'amount_too_high', minAmountEur: 5, maxAmountEur: 200 },
          status: 400,
        })
        expect(await topups()).toHaveLength(0)
      },
    )

    it.each([5.005, 20.001, 10.1234])(
      'refuses %s euros: more than two decimals',
      async (amountEur) => {
        await expect(service.startTopup(userId, amountEur)).rejects.toMatchObject({
          response: { code: 'amount_invalid' },
          status: 400,
        })
        expect(await topups()).toHaveLength(0)
      },
    )
  })

  describe('who can start', () => {
    it.each(['pending', 'rejected', 'terminated'] as const)(
      'refuses a %s member',
      async (status) => {
        const member = await em.findOneOrFail(Member, memberId)
        member.status = status
        await em.flush()

        await expect(service.startTopup(userId, 20)).rejects.toMatchObject({
          response: { code: 'member_not_active' },
          status: 403,
        })
        expect(await topups()).toHaveLength(0)
      },
    )

    it('refuses a user who has no member record', async () => {
      await expect(
        service.startTopup('00000000-0000-4000-8000-000000000000', 20),
      ).rejects.toMatchObject({ response: { code: 'member_not_active' }, status: 403 })
    })

    it('lets a member with a negative balance start', async () => {
      const charge = new WalletEntry()
      charge.member = em.getReference(Member, memberId)
      charge.amountCents = -4000
      charge.reason = 'handover_charge'
      await em.persist(charge).flush()

      const topup = await service.startTopup(userId, 20)

      expect(topup.status).toBe('pending')
    })
  })

  describe('when online payment is off', () => {
    it('refuses with payments_disabled and writes nothing', async () => {
      const off = new PaymentsService(
        em,
        new DisabledPaymentProvider(),
        new WalletService(em),
        noNotice(em),
      )

      await expect(off.startTopup(userId, 20)).rejects.toMatchObject({
        response: { code: 'payments_disabled' },
        status: 503,
      })
      expect(await topups()).toHaveLength(0)
    })
  })

  describe('the request sent to the provider', () => {
    it('keeps the provider data on the stored top-up', async () => {
      const topup = await service.startTopup(userId, 20)

      const stored = await em.fork().findOneOrFail(Topup, topup.id, { populate: ['member'] })
      expect(stored.member.id).toBe(memberId)
      expect(stored.amountCents).toBe(2000)
      expect(stored.currency).toBe('EUR')
      expect(stored.status).toBe('pending')
      expect(stored.providerRequestId).toBe(fake.lastProviderRequestId())
      expect(stored.redirectUrl).toBe(fake.lastRequest()?.returnUrl)
      expect(stored.providerPaymentId).toBeNull()
      expect(stored.walletEntry).toBeNull()
      expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now() + 14 * 60 * 1000)
    })

    it('asks for the requested amount, with our id in the return links', async () => {
      const topup = await service.startTopup(userId, 23.5)

      const sent = fake.lastRequest()
      expect(sent?.topupId).toBe(topup.id)
      expect(sent?.amountCents).toBe(2350)
      expect(sent?.returnUrl).toBe(`http://localhost:3000/account/topup/return?topup=${topup.id}`)
      expect(sent?.backUrl).toBe(`${sent?.returnUrl}&from=back`)
      expect(sent?.errorUrl).toBe(`${sent?.returnUrl}&from=error`)
    })

    it('writes no wallet entry', async () => {
      await service.startTopup(userId, 20)

      expect(await em.fork().count(WalletEntry, {})).toBe(0)
    })
  })

  describe('when the provider fails', () => {
    it('saves the top-up as failed, leaves nothing pending, and answers provider_unavailable', async () => {
      fake.breakNextCall()

      await expect(service.startTopup(userId, 20)).rejects.toMatchObject({
        response: { code: 'provider_unavailable' },
        status: 502,
      })

      const all = await topups()
      expect(all).toHaveLength(1)
      expect(all[0]?.status).toBe('failed')
      expect(await em.fork().count(Topup, { status: 'pending' })).toBe(0)
    })

    it('lets the member start again afterwards', async () => {
      fake.breakNextCall()
      await expect(service.startTopup(userId, 20)).rejects.toBeDefined()

      const topup = await service.startTopup(userId, 20)

      expect(topup.status).toBe('pending')
    })
  })
})

/**
 * Verification is the one place that can credit. Every case here ends in the ledger: the
 * number of `WalletEntry` rows is what proves "once".
 */
describe('PaymentsService verification', () => {
  let orm: MikroORM
  let em: EntityManager
  let fake: FakePaymentProvider
  let service: PaymentsService
  let userId: string
  let memberId: string

  beforeEach(async () => {
    orm = (await createTestOrm(inject('pgConfig'))).orm
    em = orm.em.fork()
    fake = new FakePaymentProvider()
    service = new PaymentsService(em, fake, new WalletService(em), noNotice(em))
    const { user, member } = await createMemberData(em, {
      user: {
        name: 'Vera Verifier',
        email: `vera-${Math.random().toString(36).slice(2)}@example.com`,
      },
      status: 'active',
    })
    userId = user.id
    memberId = member.id
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await cleanupTestOrm(orm)
  })

  const entries = () => orm.em.fork().find(WalletEntry, {})
  const stored = (id: string) => orm.em.fork().findOneOrFail(Topup, id)
  const pay = (providerPaymentId = 'pay-1', paidAmountCents = 2000) =>
    fake.settle({ status: 'paid', providerPaymentId, paidAmountCents })

  describe('a paid result', () => {
    it('credits the requested amount once, with the traceable fields', async () => {
      const topup = await service.startTopup(userId, 20)
      pay('pay-42')

      const result = await service.verifyTopup(userId, topup.id)

      expect(result.status).toBe('paid')
      const [entry, ...others] = await entries()
      expect(others).toHaveLength(0)
      expect(entry).toMatchObject({
        amountCents: 2000,
        reason: 'online_topup',
        paymentMethod: 'online',
        providerPaymentId: 'pay-42',
      })
      const row = await stored(topup.id)
      expect(row.status).toBe('paid')
      expect(row.paidAt).toBeInstanceOf(Date)
      expect(row.providerPaymentId).toBe('pay-42')
      expect(row.walletEntry?.id).toBe(entry?.id)
      const wallet = new WalletService(orm.em.fork())
      expect(await wallet.getBalanceCents(orm.em.fork(), memberId)).toBe(2000)
    })

    it('credits nothing while the provider still says pending', async () => {
      const topup = await service.startTopup(userId, 20)

      const result = await service.verifyTopup(userId, topup.id)

      expect(result.status).toBe('pending')
      expect(await entries()).toHaveLength(0)
      expect((await stored(topup.id)).lastCheckedAt).toBeInstanceOf(Date)
    })

    it('writes one entry when verified twice', async () => {
      const topup = await service.startTopup(userId, 20)
      pay()

      await service.verifyTopup(userId, topup.id)
      const second = await service.verifyTopup(userId, topup.id)

      expect(second.status).toBe('paid')
      expect(await entries()).toHaveLength(1)
    })

    it('writes one entry when two callers verify at the same moment', async () => {
      const topup = await service.startTopup(userId, 20)
      pay()
      const other = new PaymentsService(
        orm.em.fork(),
        fake,
        new WalletService(orm.em.fork()),
        noNotice(orm.em.fork()),
      )

      const [first, second] = await Promise.all([
        service.verifyTopup(userId, topup.id),
        other.verifyTopup(userId, topup.id),
      ])

      expect(first.status).toBe('paid')
      expect(second.status).toBe('paid')
      expect(await entries()).toHaveLength(1)
    })

    it('credits the requested amount when the payer paid more', async () => {
      const topup = await service.startTopup(userId, 20)
      pay('pay-1', 2300)

      await service.verifyTopup(userId, topup.id)

      const [entry] = await entries()
      expect(entry?.amountCents).toBe(2000)
    })

    it('credits nothing and leaves the status when the payer paid less, and logs the top-up id', async () => {
      const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {})
      const topup = await service.startTopup(userId, 20)
      pay('pay-1', 1500)

      const result = await service.verifyTopup(userId, topup.id)

      expect(result.status).toBe('pending')
      expect(await entries()).toHaveLength(0)
      expect((await stored(topup.id)).status).toBe('pending')
      expect(error).toHaveBeenCalledWith(expect.stringContaining(topup.id))
    })

    describe('the underpaid notice', () => {
      let sendEmail: ReturnType<typeof vi.fn>
      let mailed: PaymentsService

      beforeEach(async () => {
        vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {})
        sendEmail = vi.fn().mockResolvedValue(undefined)
        const notice = (forked: EntityManager) =>
          new MemberNoticeService(forked, { sendEmail } as unknown as EmailService)
        mailed = new PaymentsService(em, fake, new WalletService(em), notice(em))
        await createMemberData(em, {
          user: { name: 'Ada Admin', email: 'ada@example.com' },
          roles: ['member', 'admin'],
          status: 'active',
        })
      })

      it('mails the admins and stamps the top-up when the payer paid less', async () => {
        const topup = await mailed.startTopup(userId, 20)
        pay('pay-1', 1500)

        await mailed.verifyTopup(userId, topup.id)

        expect(sendEmail).toHaveBeenCalledTimes(1)
        expect(sendEmail.mock.calls[0]![0].to).toBe('ada@example.com')
        expect((await stored(topup.id)).underpaidNotifiedAt).toBeInstanceOf(Date)
      })

      it('sends nothing on a second check and keeps the first stamp', async () => {
        const topup = await mailed.startTopup(userId, 20)
        pay('pay-1', 1500)
        await mailed.verifyTopup(userId, topup.id)
        const firstStamp = (await stored(topup.id)).underpaidNotifiedAt

        await mailed.verifyTopup(userId, topup.id)
        await mailed.verifyTopup(userId, topup.id)

        expect(sendEmail).toHaveBeenCalledTimes(1)
        expect((await stored(topup.id)).underpaidNotifiedAt).toEqual(firstStamp)
      })

      it('sends one mail when two callers check at the same moment', async () => {
        const topup = await mailed.startTopup(userId, 20)
        pay('pay-1', 1500)
        const otherEm = orm.em.fork()
        const other = new PaymentsService(
          otherEm,
          fake,
          new WalletService(otherEm),
          new MemberNoticeService(otherEm, { sendEmail } as unknown as EmailService),
        )

        await Promise.all([
          mailed.verifyTopup(userId, topup.id),
          other.verifyTopup(userId, topup.id),
        ])

        expect(sendEmail).toHaveBeenCalledTimes(1)
      })

      it('sends nothing when the amount is right, the payment failed, or it is still pending', async () => {
        const exact = await mailed.startTopup(userId, 20)
        pay('pay-1', 2000)
        await mailed.verifyTopup(userId, exact.id)

        const failed = await mailed.startTopup(userId, 20)
        fake.settle({ status: 'failed' })
        await mailed.verifyTopup(userId, failed.id)

        const waiting = await mailed.startTopup(userId, 20)
        fake.settle({ status: 'pending' })
        await mailed.verifyTopup(userId, waiting.id)

        expect(sendEmail).not.toHaveBeenCalled()
        for (const id of [exact.id, failed.id, waiting.id]) {
          expect((await stored(id)).underpaidNotifiedAt ?? null).toBeNull()
        }
      })

      it('credits once and sends no second mail when the payer later pays the right amount', async () => {
        const topup = await mailed.startTopup(userId, 20)
        pay('pay-1', 1500)
        await mailed.verifyTopup(userId, topup.id)
        pay('pay-2', 2000)

        const result = await mailed.verifyTopup(userId, topup.id)

        expect(result.status).toBe('paid')
        expect(await entries()).toHaveLength(1)
        expect(sendEmail).toHaveBeenCalledTimes(1)
      })

      it('keeps the stamp, the pending status and no credit when the mail throws', async () => {
        sendEmail.mockRejectedValue(new Error('smtp down'))
        const topup = await mailed.startTopup(userId, 20)
        pay('pay-1', 1500)

        const result = await mailed.verifyTopup(userId, topup.id)

        expect(result.status).toBe('pending')
        expect(await entries()).toHaveLength(0)
        expect((await stored(topup.id)).underpaidNotifiedAt).toBeInstanceOf(Date)
      })
    })

    it('never credits the same provider payment twice, even for another top-up', async () => {
      const first = await service.startTopup(userId, 20)
      pay('pay-same')
      await service.verifyTopup(userId, first.id)
      const second = await service.startTopup(userId, 20)
      fake.settle({ status: 'paid', providerPaymentId: 'pay-same', paidAmountCents: 2000 })

      const result = await service.verifyTopup(userId, second.id)

      expect(result.status).toBe('pending')
      expect(await entries()).toHaveLength(1)
    })
  })

  describe('a failed result', () => {
    it('marks the top-up failed, writes nothing, and stays failed', async () => {
      const topup = await service.startTopup(userId, 20)
      fake.settle({ status: 'failed' })

      const result = await service.verifyTopup(userId, topup.id)
      pay()
      const again = await service.verifyTopup(userId, topup.id)

      expect(result.status).toBe('failed')
      expect(again.status).toBe('failed')
      expect(await entries()).toHaveLength(0)
    })
  })

  describe('expiry', () => {
    async function expireBy(topupId: string, minutesAgo: number) {
      const row = await em.findOneOrFail(Topup, topupId)
      row.expiresAt = new Date(Date.now() - minutesAgo * 60 * 1000)
      await em.flush()
    }

    it('expires a request the provider still calls pending, after a grace period', async () => {
      const topup = await service.startTopup(userId, 20)
      await expireBy(topup.id, 6)

      const result = await service.verifyTopup(userId, topup.id)

      expect(result.status).toBe('expired')
      expect(await entries()).toHaveLength(0)
    })

    it('keeps it pending inside the grace period', async () => {
      const topup = await service.startTopup(userId, 20)
      await expireBy(topup.id, 2)

      const result = await service.verifyTopup(userId, topup.id)

      expect(result.status).toBe('pending')
    })

    it('still credits an expired top-up that the provider later says was paid', async () => {
      const topup = await service.startTopup(userId, 20)
      await expireBy(topup.id, 6)
      await service.verifyTopup(userId, topup.id)
      pay()

      const result = await service.verifyTopup(userId, topup.id)

      expect(result.status).toBe('paid')
      expect(await entries()).toHaveLength(1)
    })
  })

  describe('edges', () => {
    it('does not ask the provider about a top-up that never reached it', async () => {
      const row = new Topup()
      row.member = em.getReference(Member, memberId)
      row.amountCents = 2000
      row.expiresAt = new Date(Date.now() + 60_000)
      await em.persist(row).flush()
      fake.breakNextCall()

      const result = await service.verifyTopup(userId, row.id)

      expect(result.status).toBe('pending')
      await expect(fake.getPaymentResult('x')).rejects.toBeDefined()
    })

    it('answers provider_unavailable and changes nothing when the provider is down', async () => {
      const topup = await service.startTopup(userId, 20)
      pay()
      fake.breakNextCall()

      await expect(service.verifyTopup(userId, topup.id)).rejects.toMatchObject({
        response: { code: 'provider_unavailable' },
        status: 502,
      })

      expect((await stored(topup.id)).status).toBe('pending')
      expect(await entries()).toHaveLength(0)
    })

    it('refuses verification with payments_disabled when online payment is off', async () => {
      const topup = await service.startTopup(userId, 20)
      const off = new PaymentsService(
        em,
        new DisabledPaymentProvider(),
        new WalletService(em),
        noNotice(em),
      )

      await expect(off.verifyTopup(userId, topup.id)).rejects.toMatchObject({
        response: { code: 'payments_disabled' },
        status: 503,
      })
    })

    it('hides another member’s top-up as not found, for reading and for verifying', async () => {
      const topup = await service.startTopup(userId, 20)
      const { user: stranger } = await createMemberData(em, {
        user: { name: 'Nosy', email: `nosy-${Math.random().toString(36).slice(2)}@example.com` },
        status: 'active',
      })
      pay()

      await expect(service.getTopup(stranger.id, topup.id)).rejects.toMatchObject({ status: 404 })
      await expect(service.verifyTopup(stranger.id, topup.id)).rejects.toMatchObject({
        status: 404,
      })
      await expect(
        service.getTopup(userId, '00000000-0000-4000-8000-000000000000'),
      ).rejects.toMatchObject({ status: 404 })
      expect(await entries()).toHaveLength(0)
    })

    it('reads the stored state without asking the provider', async () => {
      const topup = await service.startTopup(userId, 20)
      pay()
      fake.breakNextCall()

      const read = await service.getTopup(userId, topup.id)

      expect(read.status).toBe('pending')
      expect(await entries()).toHaveLength(0)
    })
  })
})

/**
 * The provider notification only nudges: it makes us ask the provider about our own recent
 * unfinished top-ups. Nothing the notification carries is ever read.
 */
describe('PaymentsService.reconcileRecent', () => {
  let orm: MikroORM
  let em: EntityManager
  let fake: FakePaymentProvider
  let service: PaymentsService
  let userId: string
  let memberId: string

  beforeEach(async () => {
    orm = (await createTestOrm(inject('pgConfig'))).orm
    em = orm.em.fork()
    fake = new FakePaymentProvider()
    service = new PaymentsService(em, fake, new WalletService(em), noNotice(em))
    const { user, member } = await createMemberData(em, {
      user: {
        name: 'Nora Nudge',
        email: `nora-${Math.random().toString(36).slice(2)}@example.com`,
      },
      status: 'active',
    })
    userId = user.id
    memberId = member.id
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await cleanupTestOrm(orm)
  })

  const entries = () => orm.em.fork().find(WalletEntry, {})
  const statusOf = async (id: string) => (await orm.em.fork().findOneOrFail(Topup, id)).status
  const payAll = (count: number) => {
    for (let i = 1; i <= count; i++) {
      fake.settle(
        { status: 'paid', providerPaymentId: `pay-${i}`, paidAmountCents: 2000 },
        `fake-request-${i}`,
      )
    }
  }

  it('credits a recent pending top-up that the provider says is paid', async () => {
    const topup = await service.startTopup(userId, 20)
    payAll(1)

    await service.reconcileRecent()

    expect(await statusOf(topup.id)).toBe('paid')
    expect(await entries()).toHaveLength(1)
  })

  it('credits nothing when the provider has no result, whatever was claimed to us', async () => {
    const topup = await service.startTopup(userId, 20)

    await service.reconcileRecent()

    expect(await statusOf(topup.id)).toBe('pending')
    expect(await entries()).toHaveLength(0)
  })

  it('writes one entry when it runs twice', async () => {
    await service.startTopup(userId, 20)
    payAll(1)

    await service.reconcileRecent()
    await service.reconcileRecent()

    expect(await entries()).toHaveLength(1)
  })

  it('does not ask again within 5 seconds when the provider failed the first time', async () => {
    await service.startTopup(userId, 20)
    const ask = vi
      .spyOn(fake, 'getPaymentResult')
      .mockRejectedValue(new PaymentProviderError('provider down'))

    await service.reconcileRecent()
    await service.reconcileRecent()

    expect(ask).toHaveBeenCalledTimes(1)
  })

  it('does not ask again about a top-up it checked less than 5 seconds ago', async () => {
    const topup = await service.startTopup(userId, 20)
    await service.reconcileRecent()
    payAll(1)

    await service.reconcileRecent()
    expect(await statusOf(topup.id)).toBe('pending')

    const row = await em.findOneOrFail(Topup, topup.id, { refresh: true })
    row.lastCheckedAt = new Date(Date.now() - 6000)
    await em.flush()
    await service.reconcileRecent()

    expect(await statusOf(topup.id)).toBe('paid')
  })

  it('ignores top-ups older than 30 minutes, finished ones, and ones the provider never saw', async () => {
    const old = await service.startTopup(userId, 20)
    const done = await service.startTopup(userId, 20)
    const row = await em.findOneOrFail(Topup, old.id, { refresh: true })
    row.createdAt = new Date(Date.now() - 31 * 60 * 1000)
    const finished = await em.findOneOrFail(Topup, done.id, { refresh: true })
    finished.status = 'expired'
    const unsent = new Topup()
    unsent.member = em.getReference(Member, memberId)
    unsent.amountCents = 2000
    unsent.expiresAt = new Date(Date.now() + 60_000)
    em.persist(unsent)
    await em.flush()
    payAll(2)

    await service.reconcileRecent()

    expect(await statusOf(old.id)).toBe('pending')
    expect(await statusOf(done.id)).toBe('expired')
    expect(await statusOf(unsent.id)).toBe('pending')
    expect(await entries()).toHaveLength(0)
  })

  it('checks at most 20 top-ups in one pass', async () => {
    for (let i = 0; i < 25; i++) await service.startTopup(userId, 10)
    payAll(25)

    await service.reconcileRecent()

    expect(await entries()).toHaveLength(20)
  })

  it('goes on with the others when the provider fails on one', async () => {
    const first = await service.startTopup(userId, 20)
    const second = await service.startTopup(userId, 20)
    payAll(2)
    fake.breakNextCall()
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {})

    await expect(service.reconcileRecent()).resolves.toBeUndefined()

    expect(await statusOf(first.id)).toBe('pending')
    expect(await statusOf(second.id)).toBe('paid')
  })

  it('does nothing when online payment is off', async () => {
    const topup = await service.startTopup(userId, 20)
    payAll(1)
    const off = new PaymentsService(
      em,
      new DisabledPaymentProvider(),
      new WalletService(em),
      noNotice(em),
    )

    await expect(off.reconcileRecent()).resolves.toBeUndefined()

    expect(await statusOf(topup.id)).toBe('pending')
  })
})
