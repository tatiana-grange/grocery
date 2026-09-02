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
})
