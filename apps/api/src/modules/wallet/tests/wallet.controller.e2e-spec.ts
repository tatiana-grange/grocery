import type { EntityManager } from '@mikro-orm/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
/**
 * E2E tests for the member account ledger: the staff routes the distribution table uses, and
 * the member-facing route that only ever reads the caller's own account.
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
import { PaymentsModule } from '../../payments/payments.module'
import { PAYMENT_PROVIDER } from '../../payments/providers/payment-provider'
import { WalletEntry } from '../entities/wallet-entry.entity'
import { WalletModule } from '../wallet.module'

describe('walletController (e2e)', () => {
  let em: EntityManager
  let request: TestRequest
  let distributor: ReturnType<typeof createSessionFromUser>
  let sendEmail: ReturnType<typeof vi.fn>
  let providerCalls: ReturnType<typeof vi.fn<(...args: unknown[]) => void>>

  const uniqueEmail = (prefix: string) =>
    `${prefix}-${Math.random().toString(36).slice(2)}@example.com`

  beforeEach(async (context) => {
    sendEmail = vi.fn().mockResolvedValue(undefined)
    providerCalls = vi.fn<(...args: unknown[]) => void>()
    // A provider that records every call, to prove a refund never reaches it.
    const watchedProvider = {
      isEnabled: true,
      createPaymentRequest: async (...args: unknown[]) => providerCalls('create', ...args),
      getPaymentResult: async (...args: unknown[]) => providerCalls('result', ...args),
    }
    const { orm, app } = await initializeTestApp(
      { orm: context.orm },
      {
        imports: [WalletModule, PaymentsModule],
        providers: [
          { provide: EmailService, useValue: { sendEmail } },
          { provide: PAYMENT_PROVIDER, useValue: watchedProvider },
        ],
      },
    )
    context.app = app
    em = orm.em.fork()
    request = createRequest(app)

    const { user } = await createMemberData(em, {
      user: { name: 'Dina Distributor', email: uniqueEmail('distributor') },
      roles: ['member', 'distributor'],
      status: 'active',
    })
    distributor = createSessionFromUser(user)
  })

  async function makeMember(name: string) {
    return createMemberData(em, {
      user: { name, email: uniqueEmail('shopper') },
      roles: ['member'],
      status: 'active',
    })
  }

  describe('POST /wallet/members/:memberId/payments', () => {
    it('credits the balance and records how it was paid (FR-026)', async () => {
      const { member } = await makeMember('Bruno Broke')

      const res = await request
        .withSession(distributor)
        .post(`/wallet/members/${member.id}/payments`)
        .send({ amountEur: 20, paymentMethod: 'cash' })

      expect(res.status).toBe(201)
      expect(res.body.balanceEur).toBe(20)
      expect(res.body.entries.data[0].paymentMethod).toBe('cash')
      expect(res.body.entries.data[0].reason).toBe('payment_received')
      expect(res.body.entries.data[0].recordedBy).toBe('Dina Distributor')
    })

    it('accepts each payment means and sums them', async () => {
      const { member } = await makeMember('Bruno Broke')
      for (const [paymentMethod, amountEur] of [
        ['cash', 10],
        ['cheque', 15],
        ['transfer', 25],
      ] as const) {
        const res = await request
          .withSession(distributor)
          .post(`/wallet/members/${member.id}/payments`)
          .send({ amountEur, paymentMethod })
        expect(res.status).toBe(201)
      }

      const wallet = await request.withSession(distributor).get(`/wallet/members/${member.id}`)
      expect(wallet.body.balanceEur).toBe(50)
      expect(wallet.body.entries.data).toHaveLength(3)
    })

    it('refuses online as a hand-recorded payment method', async () => {
      const { member } = await makeMember('Bruno Broke')

      const res = await request
        .withSession(distributor)
        .post(`/wallet/members/${member.id}/payments`)
        .send({ amountEur: 20, paymentMethod: 'online' })

      expect(res.status).toBe(400)
    })

    it('rejects a non-positive amount', async () => {
      const { member } = await makeMember('Bruno Broke')
      const res = await request
        .withSession(distributor)
        .post(`/wallet/members/${member.id}/payments`)
        .send({ amountEur: 0, paymentMethod: 'cash' })
      expect(res.status).toBe(400)
    })

    it('404s an unknown member', async () => {
      const res = await request
        .withSession(distributor)
        .post('/wallet/members/00000000-0000-4000-8000-000000000000/payments')
        .send({ amountEur: 10, paymentMethod: 'cash' })
      expect(res.status).toBe(404)
    })
  })

  describe('POST /wallet/members/:memberId/entries/:entryId/correction', () => {
    async function payTen(memberId: string) {
      const res = await request
        .withSession(distributor)
        .post(`/wallet/members/${memberId}/payments`)
        .send({ amountEur: 10, paymentMethod: 'cash' })
      return res.body.entries.data[0].id as string
    }
    const correctionUrl = (memberId: string, entryId: string) =>
      `/wallet/members/${memberId}/entries/${entryId}/correction`

    it('lets a distributor correct a payment and answers the updated wallet', async () => {
      const { member } = await makeMember('Bruno Broke')
      const entryId = await payTen(member.id)

      const res = await request
        .withSession(distributor)
        .post(correctionUrl(member.id, entryId))
        .send({ reason: 'Cheque bounced' })

      expect(res.status).toBe(201)
      expect(res.body.balanceEur).toBe(0)
      const [correction, original] = res.body.entries.data
      expect(correction.reason).toBe('payment_correction')
      expect(correction.amountEur).toBe(-10)
      expect(correction.note).toBe('Cheque bounced')
      expect(correction.recordedBy).toBe('Dina Distributor')
      expect(correction.correctsEntryId).toBe(original.id)
      expect(original.correctedByEntryId).toBe(correction.id)
    })

    it('lets an admin correct a payment too', async () => {
      const { member } = await makeMember('Bruno Broke')
      const entryId = await payTen(member.id)
      const { user } = await createMemberData(em, {
        user: { name: 'Ada Admin', email: uniqueEmail('admin') },
        roles: ['member', 'admin'],
        status: 'active',
      })

      const res = await request
        .withSession(createSessionFromUser(user))
        .post(correctionUrl(member.id, entryId))
        .send({ reason: 'Mistake' })

      expect(res.status).toBe(201)
    })

    it('refuses a plain member, on their own account and on another', async () => {
      const { member, user } = await makeMember('Fanny Funded')
      const { member: other } = await makeMember('Other Person')
      const ownEntry = await payTen(member.id)
      const otherEntry = await payTen(other.id)
      const session = createSessionFromUser(user)

      const own = await request
        .withSession(session)
        .post(correctionUrl(member.id, ownEntry))
        .send({ reason: 'x' })
      const another = await request
        .withSession(session)
        .post(correctionUrl(other.id, otherEntry))
        .send({ reason: 'x' })

      expect(own.status).toBe(403)
      expect(another.status).toBe(403)
    })

    it('refuses a call with no session', async () => {
      const { member } = await makeMember('Bruno Broke')
      const entryId = await payTen(member.id)

      const res = await request.post(correctionUrl(member.id, entryId)).send({ reason: 'x' })

      expect(res.status).toBe(401)
    })

    it('rejects a blank reason', async () => {
      const { member } = await makeMember('Bruno Broke')
      const entryId = await payTen(member.id)

      const res = await request
        .withSession(distributor)
        .post(correctionUrl(member.id, entryId))
        .send({ reason: '   ' })

      expect(res.status).toBe(400)
    })

    it('refuses a second correction with already_corrected', async () => {
      const { member } = await makeMember('Bruno Broke')
      const entryId = await payTen(member.id)
      await request
        .withSession(distributor)
        .post(correctionUrl(member.id, entryId))
        .send({ reason: 'first' })

      const res = await request
        .withSession(distributor)
        .post(correctionUrl(member.id, entryId))
        .send({ reason: 'second' })

      expect(res.status).toBe(409)
      expect(res.body.code).toBe('already_corrected')
    })

    it('refuses a correction row with not_a_manual_payment', async () => {
      const { member } = await makeMember('Bruno Broke')
      const entryId = await payTen(member.id)
      const done = await request
        .withSession(distributor)
        .post(correctionUrl(member.id, entryId))
        .send({ reason: 'first' })

      const res = await request
        .withSession(distributor)
        .post(correctionUrl(member.id, done.body.entries.data[0].id))
        .send({ reason: 'again' })

      expect(res.status).toBe(409)
      expect(res.body.code).toBe('not_a_manual_payment')
    })

    it('answers 404 for an entry of another member', async () => {
      const { member } = await makeMember('Bruno Broke')
      const { member: other } = await makeMember('Other Person')
      const entryId = await payTen(member.id)

      const res = await request
        .withSession(distributor)
        .post(correctionUrl(other.id, entryId))
        .send({ reason: 'x' })

      expect(res.status).toBe(404)
    })

    it('shows both rows, linked, in the member’s own wallet', async () => {
      const { member, user } = await makeMember('Fanny Funded')
      const entryId = await payTen(member.id)
      await request
        .withSession(distributor)
        .post(correctionUrl(member.id, entryId))
        .send({ reason: 'Mistake' })

      const res = await request.withSession(createSessionFromUser(user)).get('/me/wallet')

      expect(res.status).toBe(200)
      const [correction, original] = res.body.entries.data
      expect(correction.correctsEntryId).toBe(original.id)
      expect(original.correctedByEntryId).toBe(correction.id)
      expect(correction.note).toBe('Mistake')
    })

    describe('notice e-mails', () => {
      const mailTo = () => sendEmail.mock.calls.map(([options]) => options.to as string).sort()

      async function memberWithBalance(balanceAfterCorrectionCents: number) {
        const { member, user } = await makeMember('Mia Member')
        const paid = await request
          .withSession(distributor)
          .post(`/wallet/members/${member.id}/payments`)
          .send({ amountEur: 10, paymentMethod: 'cash' })
        const entry = new WalletEntry()
        entry.member = em.getReference(Member, member.id)
        entry.amountCents = balanceAfterCorrectionCents
        entry.reason = 'handover_reversal'
        await em.persist(entry).flush()
        return { member, user, entryId: paid.body.entries.data[0].id as string }
      }

      async function makeAdmin() {
        await createMemberData(em, {
          user: { name: 'Ada Admin', email: 'ada-admin@example.com' },
          roles: ['member', 'admin'],
          status: 'active',
        })
      }

      it('sends the mails once when the correction leaves a negative balance', async () => {
        await makeAdmin()
        const { member, user, entryId } = await memberWithBalance(-800)

        const res = await request
          .withSession(distributor)
          .post(correctionUrl(member.id, entryId))
          .send({ reason: 'Mistake' })

        expect(res.status).toBe(201)
        expect(res.body.balanceEur).toBe(-8)
        expect(mailTo()).toEqual(['ada-admin@example.com', user.email].sort())
      })

      it('sends none when the correction leaves a balance above zero', async () => {
        await makeAdmin()
        const { member, entryId } = await memberWithBalance(2500)

        const res = await request
          .withSession(distributor)
          .post(correctionUrl(member.id, entryId))
          .send({ reason: 'Mistake' })

        expect(res.status).toBe(201)
        expect(sendEmail).not.toHaveBeenCalled()
      })

      it('sends none for a refused second correction', async () => {
        const { member, entryId } = await memberWithBalance(-800)
        await request
          .withSession(distributor)
          .post(correctionUrl(member.id, entryId))
          .send({ reason: 'first' })
        sendEmail.mockClear()

        const res = await request
          .withSession(distributor)
          .post(correctionUrl(member.id, entryId))
          .send({ reason: 'second' })

        expect(res.status).toBe(409)
        expect(sendEmail).not.toHaveBeenCalled()
      })

      it('still answers 201 and keeps the entry when the mail throws', async () => {
        await makeAdmin()
        const { member, entryId } = await memberWithBalance(-800)
        sendEmail.mockRejectedValue(new Error('smtp down'))

        const res = await request
          .withSession(distributor)
          .post(correctionUrl(member.id, entryId))
          .send({ reason: 'Mistake' })

        expect(res.status).toBe(201)
        em.clear()
        expect(
          await em.count(WalletEntry, { member: member.id, reason: 'payment_correction' }),
        ).toBe(1)
      })
    })
  })

  describe('POST /wallet/members/:memberId/refunds', () => {
    const refundUrl = (memberId: string) => `/wallet/members/${memberId}/refunds`
    const refundBody = { amountEur: 10, paymentMethod: 'cheque', reason: 'Left the cooperative' }

    async function fundedMember(amountEur = 30) {
      const made = await makeMember('Fanny Funded')
      await request
        .withSession(distributor)
        .post(`/wallet/members/${made.member.id}/payments`)
        .send({ amountEur, paymentMethod: 'cash' })
      return made
    }

    async function makeAdmin() {
      const { user } = await createMemberData(em, {
        user: { name: 'Ada Admin', email: uniqueEmail('admin') },
        roles: ['member', 'admin'],
        status: 'active',
      })
      return createSessionFromUser(user)
    }

    it('lets an admin record a refund and answers the updated wallet', async () => {
      const { member } = await fundedMember()

      const res = await request
        .withSession(await makeAdmin())
        .post(refundUrl(member.id))
        .send(refundBody)

      expect(res.status).toBe(201)
      expect(res.body.balanceEur).toBe(20)
      const [refund] = res.body.entries.data
      expect(refund.reason).toBe('refund')
      expect(refund.amountEur).toBe(-10)
      expect(refund.paymentMethod).toBe('cheque')
      expect(refund.note).toBe('Left the cooperative')
      expect(refund.recordedBy).toBe('Ada Admin')
    })

    it('refuses an amount with more than two decimals', async () => {
      const { member } = await fundedMember()

      const res = await request
        .withSession(await makeAdmin())
        .post(refundUrl(member.id))
        .send({ ...refundBody, amountEur: 10.555 })

      expect(res.status).toBe(400)
      expect(await em.count(WalletEntry, { member: member.id, reason: 'refund' })).toBe(0)
    })

    it('refuses a distributor', async () => {
      const { member } = await fundedMember()
      const res = await request.withSession(distributor).post(refundUrl(member.id)).send(refundBody)
      expect(res.status).toBe(403)
      expect(await em.count(WalletEntry, { member: member.id, reason: 'refund' })).toBe(0)
    })

    it('refuses a plain member, on their own account and on another', async () => {
      const { member, user } = await fundedMember()
      const { member: other } = await makeMember('Other Person')
      const session = createSessionFromUser(user)

      const own = await request.withSession(session).post(refundUrl(member.id)).send(refundBody)
      const another = await request.withSession(session).post(refundUrl(other.id)).send(refundBody)

      expect(own.status).toBe(403)
      expect(another.status).toBe(403)
    })

    it('refuses a call with no session', async () => {
      const { member } = await fundedMember()
      const res = await request.post(refundUrl(member.id)).send(refundBody)
      expect(res.status).toBe(401)
    })

    it.each([
      ['a blank reason', { ...refundBody, reason: '   ' }],
      ['a missing reason', { amountEur: 10, paymentMethod: 'cheque' }],
      ['a zero amount', { ...refundBody, amountEur: 0 }],
      ['a negative amount', { ...refundBody, amountEur: -5 }],
      ['the online method', { ...refundBody, paymentMethod: 'online' }],
    ])('rejects %s with 400', async (_name, body) => {
      const { member } = await fundedMember()
      const res = await request
        .withSession(await makeAdmin())
        .post(refundUrl(member.id))
        .send(body)
      expect(res.status).toBe(400)
      expect(await em.count(WalletEntry, { member: member.id, reason: 'refund' })).toBe(0)
    })

    it('refuses a refund above the balance with refund_exceeds_balance', async () => {
      const { member } = await fundedMember(30)

      const res = await request
        .withSession(await makeAdmin())
        .post(refundUrl(member.id))
        .send({ ...refundBody, amountEur: 30.01 })

      expect(res.status).toBe(409)
      expect(res.body.code).toBe('refund_exceeds_balance')
      expect(res.body.balanceEur).toBe(30)
      expect(await em.count(WalletEntry, { member: member.id, reason: 'refund' })).toBe(0)
    })

    it('refuses a refund for a member with a zero balance', async () => {
      const { member } = await makeMember('Nobody Paid')
      const res = await request
        .withSession(await makeAdmin())
        .post(refundUrl(member.id))
        .send(refundBody)
      expect(res.status).toBe(409)
      expect(res.body.code).toBe('refund_exceeds_balance')
    })

    it('refunds a member who left', async () => {
      const { member } = await fundedMember()
      member.status = 'terminated'
      await em.flush()

      const res = await request
        .withSession(await makeAdmin())
        .post(refundUrl(member.id))
        .send(refundBody)

      expect(res.status).toBe(201)
    })

    it('shows the refund and its reason in the member’s own history', async () => {
      const { member, user } = await fundedMember()
      await request
        .withSession(await makeAdmin())
        .post(refundUrl(member.id))
        .send(refundBody)

      const res = await request.withSession(createSessionFromUser(user)).get('/me/wallet')

      expect(res.body.balanceEur).toBe(20)
      expect(res.body.entries.data[0]).toMatchObject({
        reason: 'refund',
        note: 'Left the cooperative',
        amountEur: -10,
      })
    })

    it('never calls the payment provider', async () => {
      const { member } = await fundedMember()
      const res = await request
        .withSession(await makeAdmin())
        .post(refundUrl(member.id))
        .send(refundBody)

      expect(res.status).toBe(201)
      expect(providerCalls).not.toHaveBeenCalled()
    })
  })

  describe('GET /wallet/members/:memberId', () => {
    it('reads zero for a member with no movement (FR-025)', async () => {
      const { member } = await makeMember('Nobody Paid')
      const res = await request.withSession(distributor).get(`/wallet/members/${member.id}`)
      expect(res.status).toBe(200)
      expect(res.body.balanceEur).toBe(0)
      expect(res.body.entries.data).toEqual([])
    })

    it('refuses a plain member reading someone else’s account (FR-023)', async () => {
      const { member } = await makeMember('Fanny Funded')
      const { user: otherUser } = await makeMember('Nosy Neighbour')
      const nosy = createSessionFromUser(otherUser)

      const res = await request.withSession(nosy).get(`/wallet/members/${member.id}`)
      expect(res.status).toBe(403)
    })
  })

  describe('GET /me/wallet', () => {
    it('returns the caller’s own balance and movements', async () => {
      const { member, user } = await makeMember('Fanny Funded')
      const entry = new WalletEntry()
      entry.member = em.getReference(Member, member.id)
      entry.amountCents = 4200
      entry.currency = 'EUR'
      entry.reason = 'payment_received'
      entry.paymentMethod = 'transfer'
      await em.persist(entry).flush()

      const res = await request.withSession(createSessionFromUser(user)).get('/me/wallet')
      expect(res.status).toBe(200)
      expect(res.body.memberId).toBe(member.id)
      expect(res.body.balanceEur).toBe(42)
    })

    it('never exposes another member’s account — there is no id to pass', async () => {
      const { user } = await makeMember('Fanny Funded')
      const res = await request.withSession(createSessionFromUser(user)).get('/me/wallet')
      expect(res.body.entries.data).toEqual([])
    })

    it('refuses an anonymous caller', async () => {
      const res = await request.get('/me/wallet')
      expect(res.status).toBe(401)
    })
  })
})
