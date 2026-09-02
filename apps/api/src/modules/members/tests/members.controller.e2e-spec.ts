import { beforeEach, describe, expect, it } from 'vitest'
/**
 * E2E tests for the back-office member endpoints.
 *
 * - GET  /admin/members
 * - GET  /admin/members/:id
 * - POST /admin/members/:id/validation   (validate | reject)
 * - GET/PUT /admin/membership-intake
 *
 * The mocked-auth e2e harness cannot exercise the real HTTP sign-up path, so the
 * "sign-up creates a pending member" wiring is verified manually (see quickstart.md);
 * here we arrange members directly with the factory.
 */
import type { EntityManager } from '@mikro-orm/core'
import { EmailService } from '../../email/email.service'
import { SmsService } from '../../auth/sms.service'
import { initializeTestApp } from '../../../test/helpers/test-app.helper'
import { createRequest, createSessionFromUser } from '../../../test/helpers/test-auth.helper'
import { createMemberData } from '../members.factory'
import { MembersModule } from '../members.module'

const noopEmail = { sendEmail: async () => undefined, verifyConnection: async () => true }
const noopSms = { sendSms: async () => undefined }

describe('membersController (e2e)', () => {
  beforeEach(async (context) => {
    const { orm, app } = await initializeTestApp(
      { orm: context.orm },
      {
        imports: [MembersModule],
        providers: [
          { provide: EmailService, useValue: noopEmail },
          { provide: SmsService, useValue: noopSms },
        ],
      },
    )
    context.app = app
    context.em = orm.em.fork()
    context.request = createRequest(app)
  })

  async function arrangeAdmin(em: EntityManager) {
    const { user } = await createMemberData(em, {
      user: { name: 'Admin', email: `admin-${Math.random().toString(36).slice(2)}@example.com` },
      roles: ['member', 'admin'],
      status: 'active',
    })
    return createSessionFromUser(user)
  }

  describe('gET /admin/members', () => {
    it('lists members and filters by status', async (context) => {
      const { em, request } = context
      const adminSession = await arrangeAdmin(em)
      await createMemberData(em, { status: 'pending', user: { name: 'Pending Pat' } })
      await createMemberData(em, { status: 'active', user: { name: 'Active Alex' } })

      const all = await request.withSession(adminSession).get('/admin/members')
      expect(all.status).toBe(200)
      expect(all.body.data.length).toBeGreaterThanOrEqual(3)

      const pendingOnly = await request
        .withSession(adminSession)
        .get('/admin/members?filter=status:eq:pending')
      expect(pendingOnly.status).toBe(200)
      expect(pendingOnly.body.data.every((m: { status: string }) => m.status === 'pending')).toBe(
        true,
      )
    })

    it('returns 401 unauthenticated and 403 for a plain member', async (context) => {
      const { em, request } = context
      const { user: plain } = await createMemberData(em, { roles: ['member'], status: 'active' })

      expect((await request.get('/admin/members')).status).toBe(401)
      expect(
        (await request.withSession(createSessionFromUser(plain)).get('/admin/members')).status,
      ).toBe(403)
    })
  })

  describe('pOST /admin/members/:id/validation', () => {
    it('validates a pending member', async (context) => {
      const { em, request } = context
      const adminSession = await arrangeAdmin(em)
      const { member } = await createMemberData(em, { status: 'pending' })

      const res = await request
        .withSession(adminSession)
        .post(`/admin/members/${member.id}/validation`)
        .send({ decision: 'validate', version: member.version })

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ id: member.id, status: 'active' })
      expect(res.body.joinedAt).toBeTruthy()
      expect(res.body.statusHistory.at(-1)).toMatchObject({ toStatus: 'active' })
    })

    it('rejects a pending member with a reason', async (context) => {
      const { em, request } = context
      const adminSession = await arrangeAdmin(em)
      const { member } = await createMemberData(em, { status: 'pending' })

      const res = await request
        .withSession(adminSession)
        .post(`/admin/members/${member.id}/validation`)
        .send({ decision: 'reject', reason: 'Incomplete details', version: member.version })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('rejected')
      expect(res.body.statusHistory.at(-1)).toMatchObject({
        toStatus: 'rejected',
        reason: 'Incomplete details',
      })
    })

    it('returns 409 on a stale version', async (context) => {
      const { em, request } = context
      const adminSession = await arrangeAdmin(em)
      const { member } = await createMemberData(em, { status: 'pending' })

      const res = await request
        .withSession(adminSession)
        .post(`/admin/members/${member.id}/validation`)
        .send({ decision: 'validate', version: member.version + 99 })

      expect(res.status).toBe(409)
    })

    it('returns 400 when the member is not pending', async (context) => {
      const { em, request } = context
      const adminSession = await arrangeAdmin(em)
      const { member } = await createMemberData(em, { status: 'active' })

      const res = await request
        .withSession(adminSession)
        .post(`/admin/members/${member.id}/validation`)
        .send({ decision: 'validate', version: member.version })

      expect(res.status).toBe(400)
    })
  })

  describe('membership intake', () => {
    it('reads and updates the intake switch', async (context) => {
      const { em, request } = context
      const adminSession = await arrangeAdmin(em)

      const initial = await request.withSession(adminSession).get('/admin/membership-intake')
      expect(initial.body).toEqual({ open: true })

      const closed = await request
        .withSession(adminSession)
        .put('/admin/membership-intake')
        .send({ open: false })
      expect(closed.body).toEqual({ open: false })

      const reread = await request.withSession(adminSession).get('/admin/membership-intake')
      expect(reread.body).toEqual({ open: false })
    })
  })

  describe('member self-service', () => {
    it('returns the active member’s own account and refuses a pending one', async (context) => {
      const { em, request } = context
      const { user: active } = await createMemberData(em, { status: 'active' })
      const { user: pending } = await createMemberData(em, { status: 'pending' })

      const mine = await request.withSession(createSessionFromUser(active)).get('/members/me')
      expect(mine.status).toBe(200)
      expect(mine.body).toMatchObject({ status: 'active', fee: { state: 'unpaid' } })

      const denied = await request.withSession(createSessionFromUser(pending)).get('/members/me')
      expect(denied.status).toBe(403)
    })

    it('updates the profile and rejects a stale version', async (context) => {
      const { em, request } = context
      const { user, member } = await createMemberData(em, { status: 'active' })
      const session = createSessionFromUser(user)

      const ok = await request
        .withSession(session)
        .put('/members/me/profile')
        .send({ name: 'Zoé Martin', city: 'Nantes', version: member.version })
      expect(ok.status).toBe(200)
      expect(ok.body.name).toBe('Zoé Martin')
      expect(ok.body.profile.city).toBe('Nantes')

      const stale = await request
        .withSession(session)
        .put('/members/me/profile')
        .send({ city: 'Rennes', version: member.version })
      expect(stale.status).toBe(409)
    })
  })

  describe('roles', () => {
    it('grants and removes the admin role and protects the last admin', async (context) => {
      const { em, request } = context
      const adminSession = await arrangeAdmin(em)
      const { member } = await createMemberData(em, { status: 'active', roles: ['member'] })

      const granted = await request
        .withSession(adminSession)
        .put(`/admin/members/${member.id}/roles`)
        .send({ roles: ['member', 'admin'], version: member.version })
      expect(granted.status).toBe(200)
      expect(granted.body.roles).toEqual(expect.arrayContaining(['member', 'admin']))

      const removed = await request
        .withSession(adminSession)
        .put(`/admin/members/${member.id}/roles`)
        .send({ roles: ['member'], version: granted.body.version })
      expect(removed.status).toBe(200)
      expect(removed.body.roles).toEqual(['member'])
    })

    it('refuses to remove the last administrator', async (context) => {
      const { em, request } = context
      // Exactly one admin: the one we arrange here.
      const { user, member } = await createMemberData(em, {
        user: { name: 'Only Admin', email: `only-${Math.random().toString(36).slice(2)}@example.com` },
        roles: ['member', 'admin'],
        status: 'active',
      })

      const res = await request
        .withSession(createSessionFromUser(user))
        .put(`/admin/members/${member.id}/roles`)
        .send({ roles: ['member'], version: member.version })
      expect(res.status).toBe(409)
    })
  })

  describe('termination', () => {
    it('lets a member self-terminate and then locks them out', async (context) => {
      const { em, request } = context
      const { user } = await createMemberData(em, { status: 'active' })
      const session = createSessionFromUser(user)

      const res = await request
        .withSession(session)
        .post('/members/me/termination')
        .send({ confirm: true })
      expect(res.status).toBe(200)
      expect(res.body.status).toBe('terminated')

      const after = await request.withSession(session).get('/members/me')
      expect(after.status).toBe(403)
    })

    it('lets an admin terminate with a reason and reactivate with data intact', async (context) => {
      const { em, request } = context
      const adminSession = await arrangeAdmin(em)
      const { member } = await createMemberData(em, {
        status: 'active',
        profile: { city: 'Nantes' },
      })

      const terminated = await request
        .withSession(adminSession)
        .post(`/admin/members/${member.id}/termination`)
        .send({ reason: 'Moved away', version: member.version })
      expect(terminated.status).toBe(200)
      expect(terminated.body.status).toBe('terminated')
      expect(terminated.body.statusHistory.at(-1)).toMatchObject({
        toStatus: 'terminated',
        reason: 'Moved away',
      })

      const reactivated = await request
        .withSession(adminSession)
        .post(`/admin/members/${member.id}/reactivation`)
        .send({ version: terminated.body.version })
      expect(reactivated.status).toBe(200)
      expect(reactivated.body).toMatchObject({ status: 'active', profile: { city: 'Nantes' } })
    })
  })

  describe('membership fee', () => {
    it('moves through unpaid → partly_paid → paid and back with an adjustment', async (context) => {
      const { em, request } = context
      const adminSession = await arrangeAdmin(em)
      const { member } = await createMemberData(em, { status: 'active', expectedFeeCents: 2000 })

      const pay = (amountCents: number, kind = 'payment') =>
        request
          .withSession(adminSession)
          .post(`/admin/members/${member.id}/fee/payments`)
          .send({ kind, amountCents, method: 'cash', paidAt: '2026-09-02' })

      expect((await pay(1000)).body.state).toBe('partly_paid')
      expect((await pay(1000)).body.state).toBe('paid')
      expect((await pay(-500, 'adjustment')).body.state).toBe('partly_paid')

      const payments = await request
        .withSession(adminSession)
        .get(`/admin/members/${member.id}/fee/payments`)
      expect(payments.body).toHaveLength(3)
    })
  })
})
