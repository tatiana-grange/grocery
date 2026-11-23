import type { EntityManager } from '@mikro-orm/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
/**
 * E2E tests for the member top-up routes, with the in-memory fake provider.
 */
import { initializeTestApp } from '../../../test/helpers/test-app.helper'
import {
  createRequest,
  createSessionFromUser,
  type TestRequest,
} from '../../../test/helpers/test-auth.helper'
import { EmailService } from '../../email/email.service'
import { Member } from '../../members/entities/member.entity'
import { createMemberData } from '../../members/members.factory'
import { WalletEntry } from '../../wallet/entities/wallet-entry.entity'
import { Topup } from '../entities/topup.entity'
import { PaymentsModule } from '../payments.module'
import { FakePaymentProvider } from '../providers/fake-payment.provider'
import { PAYMENT_PROVIDER } from '../providers/payment-provider'

describe('topupController (e2e)', () => {
  let em: EntityManager
  let request: TestRequest
  let fake: FakePaymentProvider
  let sendEmail: ReturnType<typeof vi.fn>

  const uniqueEmail = (prefix: string) =>
    `${prefix}-${Math.random().toString(36).slice(2)}@example.com`

  async function startApp(
    context: { orm: Parameters<typeof initializeTestApp>[0]['orm'] },
    enabled: boolean,
  ) {
    fake = new FakePaymentProvider()
    sendEmail = vi.fn().mockResolvedValue(undefined)
    const { orm, app } = await initializeTestApp(
      { orm: context.orm },
      {
        imports: [PaymentsModule],
        providers: [
          { provide: EmailService, useValue: { sendEmail } },
          ...(enabled ? [{ provide: PAYMENT_PROVIDER, useValue: fake }] : []),
        ],
      },
    )
    em = orm.em.fork()
    request = createRequest(app)
    return app
  }

  async function sessionFor(status: 'active' | 'pending' | 'rejected' | 'terminated') {
    const { user } = await createMemberData(em, {
      user: { name: `A ${status} member`, email: uniqueEmail(status) },
      roles: ['member'],
      status,
    })
    return createSessionFromUser(user)
  }

  describe('GET /me/topups/options', () => {
    describe('with a provider configured', () => {
      beforeEach(async (context) => {
        context.app = await startApp(context, true)
      })

      it('says top-up is on, with the bounds and the quick amounts', async () => {
        const res = await request.withSession(await sessionFor('active')).get('/me/topups/options')

        expect(res.status).toBe(200)
        expect(res.body).toEqual({
          enabled: true,
          minAmountEur: 5,
          maxAmountEur: 200,
          quickAmountsEur: [10, 20, 50],
        })
      })

      it.each(['pending', 'rejected', 'terminated'] as const)(
        'refuses a %s member',
        async (status) => {
          const res = await request.withSession(await sessionFor(status)).get('/me/topups/options')
          expect(res.status).toBe(403)
        },
      )

      it('refuses an anonymous caller', async () => {
        const res = await request.get('/me/topups/options')
        expect(res.status).toBe(401)
      })
    })

    describe('without settings', () => {
      beforeEach(async (context) => {
        context.app = await startApp(context, false)
      })

      it('still answers, and says top-up is off', async () => {
        const res = await request.withSession(await sessionFor('active')).get('/me/topups/options')

        expect(res.status).toBe(200)
        expect(res.body.enabled).toBe(false)
      })
    })
  })
  describe('POST /me/topups', () => {
    beforeEach(async (context) => {
      context.app = await startApp(context, true)
    })

    it('starts a top-up and sends the payer to the provider', async () => {
      const res = await request
        .withSession(await sessionFor('active'))
        .post('/me/topups')
        .send({ amountEur: 20 })

      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({ amountEur: 20, status: 'pending', paidAt: null })
      expect(res.body.redirectUrl).toBe(fake.lastRequest()?.returnUrl)
      expect(res.body.id).toBe(fake.lastRequest()?.topupId)
      expect(typeof res.body.expiresAt).toBe('string')
    })

    it('lets a member with a negative balance start', async () => {
      const { user, member } = await createMemberData(em, {
        user: { name: 'In The Red', email: uniqueEmail('red') },
        status: 'active',
      })
      const charge = new WalletEntry()
      charge.member = em.getReference(Member, member.id)
      charge.amountCents = -3000
      charge.reason = 'handover_charge'
      await em.persist(charge).flush()

      const res = await request
        .withSession(createSessionFromUser(user))
        .post('/me/topups')
        .send({ amountEur: 10 })

      expect(res.status).toBe(201)
    })

    it.each([
      [3, 'amount_too_low'],
      [250, 'amount_too_high'],
      [5.005, 'amount_invalid'],
    ])('refuses %s euros with %s and names the bounds', async (amountEur, code) => {
      const res = await request
        .withSession(await sessionFor('active'))
        .post('/me/topups')
        .send({ amountEur })

      expect(res.status).toBe(400)
      expect(res.body).toMatchObject({ code, minAmountEur: 5, maxAmountEur: 200 })
    })

    it('refuses a missing or non-positive amount', async () => {
      const session = await sessionFor('active')
      expect((await request.withSession(session).post('/me/topups').send({})).status).toBe(400)
      expect(
        (await request.withSession(session).post('/me/topups').send({ amountEur: 0 })).status,
      ).toBe(400)
      expect(
        (await request.withSession(session).post('/me/topups').send({ amountEur: -5 })).status,
      ).toBe(400)
    })

    it.each(['pending', 'rejected', 'terminated'] as const)(
      'refuses a %s member',
      async (status) => {
        const res = await request
          .withSession(await sessionFor(status))
          .post('/me/topups')
          .send({ amountEur: 20 })

        expect(res.status).toBe(403)
      },
    )

    it('refuses an admin whose own member record is not active', async () => {
      const { user } = await createMemberData(em, {
        user: { name: 'Admin Pending', email: uniqueEmail('admin') },
        roles: ['admin'],
        status: 'pending',
      })

      const res = await request
        .withSession(createSessionFromUser(user))
        .post('/me/topups')
        .send({ amountEur: 20 })

      expect(res.status).toBe(403)
      expect(res.body.code).toBe('member_not_active')
    })

    it('refuses an anonymous caller', async () => {
      const res = await request.post('/me/topups').send({ amountEur: 20 })

      expect(res.status).toBe(401)
    })

    it('answers 502 provider_unavailable when the provider is down, and nothing stays pending', async () => {
      fake.breakNextCall()

      const res = await request
        .withSession(await sessionFor('active'))
        .post('/me/topups')
        .send({ amountEur: 20 })

      expect(res.status).toBe(502)
      expect(res.body.code).toBe('provider_unavailable')
      expect(await em.fork().count(Topup, { status: 'pending' })).toBe(0)
    })
  })

  describe('POST /me/topups without settings', () => {
    beforeEach(async (context) => {
      context.app = await startApp(context, false)
    })

    it('answers 503 payments_disabled', async () => {
      const res = await request
        .withSession(await sessionFor('active'))
        .post('/me/topups')
        .send({ amountEur: 20 })

      expect(res.status).toBe(503)
      expect(res.body.code).toBe('payments_disabled')
    })
  })
  describe('reading and verifying a top-up', () => {
    let owner: ReturnType<typeof createSessionFromUser>
    let ownerMemberId: string

    beforeEach(async (context) => {
      context.app = await startApp(context, true)
      const { user, member } = await createMemberData(em, {
        user: { name: 'Olive Owner', email: uniqueEmail('owner') },
        status: 'active',
      })
      owner = createSessionFromUser(user)
      ownerMemberId = member.id
    })

    async function start(amountEur = 20) {
      const res = await request.withSession(owner).post('/me/topups').send({ amountEur })
      return res.body.id as string
    }

    const verify = (id: string, session = owner) =>
      request.withSession(session).post(`/me/topups/${id}/verification`)

    const wallet = () => request.withSession(owner).get('/me/wallet')

    it('reads the stored state of its own top-up', async () => {
      const id = await start()

      const res = await request.withSession(owner).get(`/me/topups/${id}`)

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ id, amountEur: 20, status: 'pending' })
    })

    it('does not credit on a plain read, even when the provider says paid', async () => {
      const id = await start()
      fake.settle({ status: 'paid', providerPaymentId: 'pay-1', paidAmountCents: 2000 })

      const res = await request.withSession(owner).get(`/me/topups/${id}`)

      expect(res.body.status).toBe('pending')
      expect((await wallet()).body.balanceEur).toBe(0)
    })

    it('credits the requested amount after verification, with a traceable entry', async () => {
      const id = await start()
      fake.settle({ status: 'paid', providerPaymentId: 'pay-77', paidAmountCents: 2300 })

      const res = await verify(id)

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ id, status: 'paid' })
      expect(typeof res.body.paidAt).toBe('string')
      const body = (await wallet()).body
      expect(body.balanceEur).toBe(20)
      expect(body.entries.data).toHaveLength(1)
      expect(body.entries.data[0]).toMatchObject({
        amountEur: 20,
        reason: 'online_topup',
        paymentMethod: 'online',
        providerPaymentId: 'pay-77',
      })
    })

    it('answers pending and credits nothing while the provider has no result', async () => {
      const id = await start()

      const res = await verify(id)

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('pending')
      expect((await wallet()).body.entries.data).toEqual([])
    })

    it('writes one entry however many times it is verified', async () => {
      const id = await start()
      fake.settle({ status: 'paid', providerPaymentId: 'pay-1', paidAmountCents: 2000 })

      await verify(id)
      await verify(id)
      await verify(id)

      expect((await wallet()).body.entries.data).toHaveLength(1)
    })

    it.each([
      ['failed', { status: 'failed' as const }],
      ['abandoned', { status: 'pending' as const }],
    ])('writes no entry for a %s payment', async (_name, result) => {
      const id = await start()
      fake.settle(result)

      const res = await verify(id)

      expect(res.status).toBe(200)
      expect((await wallet()).body.entries.data).toEqual([])
    })

    it('expires a pending request after its time is up, and credits nothing', async () => {
      const id = await start()
      const row = await em.findOneOrFail(Topup, id)
      row.expiresAt = new Date(Date.now() - 6 * 60 * 1000)
      await em.flush()

      const res = await verify(id)

      expect(res.body.status).toBe('expired')
      expect((await wallet()).body.entries.data).toEqual([])
    })

    it('credits nothing when the payer paid less than requested', async () => {
      const id = await start()
      fake.settle({ status: 'paid', providerPaymentId: 'pay-1', paidAmountCents: 500 })

      const res = await verify(id)

      expect(res.body.status).toBe('pending')
      expect((await wallet()).body.balanceEur).toBe(0)
    })

    it('answers 502 provider_unavailable when the provider is down, and changes nothing', async () => {
      const id = await start()
      fake.settle({ status: 'paid', providerPaymentId: 'pay-1', paidAmountCents: 2000 })
      fake.breakNextCall()

      const res = await verify(id)

      expect(res.status).toBe(502)
      expect(res.body.code).toBe('provider_unavailable')
      expect((await request.withSession(owner).get(`/me/topups/${id}`)).body.status).toBe('pending')
      expect((await verify(id)).body.status).toBe('paid')
    })

    it('hides another member’s top-up, to read and to verify', async () => {
      const id = await start()
      fake.settle({ status: 'paid', providerPaymentId: 'pay-1', paidAmountCents: 2000 })
      const stranger = await sessionFor('active')

      const read = await request.withSession(stranger).get(`/me/topups/${id}`)
      const verified = await verify(id, stranger)

      expect(read.status).toBe(404)
      expect(verified.status).toBe(404)
      expect((await wallet()).body.entries.data).toEqual([])
    })

    it('answers 404 for an unknown id and 400 for a malformed one', async () => {
      const unknown = await request
        .withSession(owner)
        .get('/me/topups/00000000-0000-4000-8000-000000000000')
      const malformed = await request.withSession(owner).get('/me/topups/not-an-id')

      expect(unknown.status).toBe(404)
      expect(malformed.status).toBe(400)
    })

    it('refuses an anonymous caller on both routes', async () => {
      const id = await start()

      expect((await request.get(`/me/topups/${id}`)).status).toBe(401)
      expect((await request.post(`/me/topups/${id}/verification`)).status).toBe(401)
    })

    it('does not mix the options route up with an id', async () => {
      const res = await request.withSession(owner).get('/me/topups/options')

      expect(res.status).toBe(200)
      expect(ownerMemberId).toBeDefined()
    })
  })

  describe('without settings', () => {
    beforeEach(async (context) => {
      context.app = await startApp(context, false)
    })

    it('still reads a stored top-up but refuses to verify it with payments_disabled', async () => {
      const { user, member } = await createMemberData(em, {
        user: { name: 'Old Topup', email: uniqueEmail('old') },
        status: 'active',
      })
      const row = new Topup()
      row.member = em.getReference(Member, member.id)
      row.amountCents = 2000
      row.providerRequestId = 'earlier'
      row.expiresAt = new Date(Date.now() + 60_000)
      await em.persist(row).flush()
      const session = createSessionFromUser(user)

      const read = await request.withSession(session).get(`/me/topups/${row.id}`)
      const verified = await request.withSession(session).post(`/me/topups/${row.id}/verification`)

      expect(read.status).toBe(200)
      expect(verified.status).toBe(503)
      expect(verified.body.code).toBe('payments_disabled')
    })
  })
  describe('POST /payments/notifications/helloasso', () => {
    let owner: ReturnType<typeof createSessionFromUser>

    beforeEach(async (context) => {
      context.app = await startApp(context, true)
      const { user } = await createMemberData(em, {
        user: { name: 'Nina Notified', email: uniqueEmail('notified') },
        status: 'active',
      })
      owner = createSessionFromUser(user)
    })

    async function start(amountEur = 20) {
      const res = await request.withSession(owner).post('/me/topups').send({ amountEur })
      return res.body.id as string
    }

    const notify = (body: unknown = {}) =>
      request.post('/payments/notifications/helloasso').send(body as object)
    const wallet = () => request.withSession(owner).get('/me/wallet')

    it('needs no session and always answers received', async () => {
      const res = await notify({ eventType: 'Payment', data: { id: 1 } })

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ received: true })
    })

    it.each([
      ['an empty object', {}],
      ['an array', [1, 2, 3]],
      ['a string', 'junk'],
      ['nested junk', { a: { b: [null, 1, 'x'] } }],
    ])('answers 200 to %s and credits nothing', async (_name, body) => {
      await start()

      const res = await request.post('/payments/notifications/helloasso').send(body as object)

      expect(res.status).toBe(200)
      expect((await wallet()).body.entries.data).toEqual([])
    })

    it('answers 200 with no body at all', async () => {
      const res = await request.post('/payments/notifications/helloasso')

      expect(res.status).toBe(200)
    })

    it('credits nothing on a false claim of payment that the provider does not confirm', async () => {
      const id = await start()

      const res = await notify({
        eventType: 'Payment',
        data: { state: 'Authorized', amount: 2000, order: { id }, id: 999 },
      })

      expect(res.status).toBe(200)
      expect((await wallet()).body.entries.data).toEqual([])
      expect((await request.withSession(owner).get(`/me/topups/${id}`)).body.status).toBe('pending')
    })

    it('credits once when the provider confirms, however many times it is told', async () => {
      await start()
      fake.settle({ status: 'paid', providerPaymentId: 'pay-1', paidAmountCents: 2000 })

      await notify()
      await notify()

      const body = (await wallet()).body
      expect(body.balanceEur).toBe(20)
      expect(body.entries.data).toHaveLength(1)
    })

    it('mails the admins once when the payer paid less, however it is checked', async () => {
      await createMemberData(em, {
        user: { name: 'Ada Admin', email: 'ada-admin@example.com' },
        roles: ['member', 'admin'],
        status: 'active',
      })
      const id = await start()
      fake.settle({ status: 'paid', providerPaymentId: 'pay-1', paidAmountCents: 500 })

      await notify()
      await request.withSession(owner).post(`/me/topups/${id}/verification`)
      await request.withSession(owner).post(`/me/topups/${id}/verification`)
      await notify()

      expect(sendEmail).toHaveBeenCalledTimes(1)
      expect(sendEmail.mock.calls[0]![0].to).toBe('ada-admin@example.com')
      expect((await wallet()).body.entries.data).toEqual([])
      expect((await request.withSession(owner).get(`/me/topups/${id}`)).body.status).toBe('pending')
    })

    it('then leaves the member’s return to find the top-up already paid, with one entry', async () => {
      const id = await start()
      fake.settle({ status: 'paid', providerPaymentId: 'pay-1', paidAmountCents: 2000 })

      await notify()
      const back = await request.withSession(owner).post(`/me/topups/${id}/verification`)

      expect(back.body.status).toBe('paid')
      expect((await wallet()).body.entries.data).toHaveLength(1)
    })

    it('after the member’s return, finds nothing left to do, and the entry stays single', async () => {
      const id = await start()
      fake.settle({ status: 'paid', providerPaymentId: 'pay-1', paidAmountCents: 2000 })

      await request.withSession(owner).post(`/me/topups/${id}/verification`)
      const res = await notify()

      expect(res.status).toBe(200)
      expect((await wallet()).body.entries.data).toHaveLength(1)
    })
  })
})
