import type { EntityManager } from '@mikro-orm/core'
import { beforeEach, describe, expect, it } from 'vitest'
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
import { Member } from '../../members/entities/member.entity'
import { createMemberData } from '../../members/members.factory'
import { WalletEntry } from '../entities/wallet-entry.entity'
import { WalletModule } from '../wallet.module'

describe('walletController (e2e)', () => {
  let em: EntityManager
  let request: TestRequest
  let distributor: ReturnType<typeof createSessionFromUser>

  const uniqueEmail = (prefix: string) =>
    `${prefix}-${Math.random().toString(36).slice(2)}@example.com`

  beforeEach(async (context) => {
    const { orm, app } = await initializeTestApp({ orm: context.orm }, { imports: [WalletModule] })
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
