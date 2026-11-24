import type { EntityManager } from '@mikro-orm/core'
import { beforeEach, describe, expect, it } from 'vitest'
import { initializeTestApp } from '../../../test/helpers/test-app.helper'
import {
  createRequest,
  createSessionFromUser,
  type TestRequest,
} from '../../../test/helpers/test-auth.helper'
import { createMemberData } from '../../members/members.factory'
import { AccountingModule } from '../accounting.module'

describe('association expenses (e2e)', () => {
  let em: EntityManager
  let request: TestRequest
  let admin: ReturnType<typeof createSessionFromUser>
  let member: ReturnType<typeof createSessionFromUser>
  let distributor: ReturnType<typeof createSessionFromUser>

  beforeEach(async (context) => {
    const { orm, app } = await initializeTestApp(
      { orm: context.orm },
      { imports: [AccountingModule] },
    )
    context.app = app
    em = orm.em.fork()
    request = createRequest(app)

    const adminData = await createMemberData(em, {
      user: { name: 'Ada Admin' },
      roles: ['member', 'admin'],
      status: 'active',
    })
    admin = createSessionFromUser(adminData.user)
    const memberData = await createMemberData(em, { user: { name: 'Mia Member' } })
    member = createSessionFromUser(memberData.user)
    const distributorData = await createMemberData(em, {
      user: { name: 'Dan Distributor' },
      roles: ['member', 'distributor'],
    })
    distributor = createSessionFromUser(distributorData.user)
  })

  function expenseBody(overrides: Record<string, unknown> = {}) {
    return {
      spentOn: '2026-03-10',
      amountCents: 45000,
      category: 'rent',
      label: 'March rent',
      paymentMethod: 'transfer',
      ...overrides,
    }
  }

  async function record(overrides: Record<string, unknown> = {}) {
    const res = await request
      .withSession(admin)
      .post('/admin/expenses')
      .send(expenseBody(overrides))
    expect(res.status).toBe(201)
    return res.body as { id: string; spentOn: string }
  }

  const period = 'from=2026-03-01&to=2026-03-31'

  describe('record and list', () => {
    it('an admin records an expense and finds it in the list for its period (201 then 200)', async () => {
      const created = await request.withSession(admin).post('/admin/expenses').send(expenseBody())
      expect(created.status).toBe(201)
      expect(created.body).toMatchObject({
        spentOn: '2026-03-10',
        amountCents: 45000,
        category: 'rent',
        label: 'March rent',
        paymentMethod: 'transfer',
        kind: 'expense',
        cancelsExpenseId: null,
        cancelledByExpenseId: null,
        isCancelled: false,
        reason: null,
        recordedByName: 'Ada Admin',
      })

      const list = await request.withSession(admin).get(`/admin/expenses?${period}`)
      expect(list.status).toBe(200)
      expect(list.body.data.map((row: { id: string }) => row.id)).toEqual([created.body.id])
      expect(list.body.data[0].spentOn).toBe('2026-03-10')
      expect(list.body.meta.itemCount).toBe(1)
    })

    it('refuses a member and a distributor on both routes with 403', async () => {
      const responses = []
      for (const session of [member, distributor]) {
        responses.push(await request.withSession(session).get(`/admin/expenses?${period}`))
        responses.push(
          await request.withSession(session).post('/admin/expenses').send(expenseBody()),
        )
      }

      expect(responses.map((res) => res.status)).toEqual([403, 403, 403, 403])
    })

    it('refuses a caller with no session with 401', async () => {
      const responses = await Promise.all([
        request.get(`/admin/expenses?${period}`),
        request.post('/admin/expenses').send(expenseBody()),
      ])

      expect(responses.map((res) => res.status)).toEqual([401, 401])
    })

    it.each([
      ['an amount of 0', { amountCents: 0 }],
      ['a negative amount', { amountCents: -100 }],
      ['a decimal amount', { amountCents: 10.5 }],
      ['an amount above the column limit', { amountCents: 2147483648 }],
      ['an unknown category', { category: 'travel' }],
      ['an unknown payment method', { paymentMethod: 'bitcoin' }],
      ['an empty label', { label: '   ' }],
      ['a label of 201 characters', { label: 'x'.repeat(201) }],
      ['a day that does not exist', { spentOn: '2026-02-30' }],
      ['a date with a time', { spentOn: '2026-03-10T10:00:00Z' }],
    ])('rejects %s with 400', async (_name, overrides) => {
      const res = await request
        .withSession(admin)
        .post('/admin/expenses')
        .send(expenseBody(overrides))

      expect(res.status).toBe(400)
    })

    it('accepts a label of 200 characters, the largest amount and a day in the future', async () => {
      const res = await request
        .withSession(admin)
        .post('/admin/expenses')
        .send(
          expenseBody({ label: 'x'.repeat(200), amountCents: 2147483647, spentOn: '2099-01-01' }),
        )

      expect(res.status).toBe(201)
    })

    it('leaves out an expense the day before from and the day after to, and keeps both bounds', async () => {
      const before = await record({ spentOn: '2026-02-28' })
      const first = await record({ spentOn: '2026-03-01' })
      const last = await record({ spentOn: '2026-03-31' })
      const after = await record({ spentOn: '2026-04-01' })

      const list = await request.withSession(admin).get(`/admin/expenses?${period}`)

      const ids = list.body.data.map((row: { id: string }) => row.id)
      expect(ids).toEqual(expect.arrayContaining([first.id, last.id]))
      expect(ids).not.toContain(before.id)
      expect(ids).not.toContain(after.id)
      expect(ids).toHaveLength(2)
    })

    it('lists the newest day first', async () => {
      const middle = await record({ spentOn: '2026-03-10' })
      const newest = await record({ spentOn: '2026-03-20' })
      const oldest = await record({ spentOn: '2026-03-02' })

      const list = await request.withSession(admin).get(`/admin/expenses?${period}`)

      expect(list.body.data.map((row: { id: string }) => row.id)).toEqual([
        newest.id,
        middle.id,
        oldest.id,
      ])
    })

    it('pages the list with a default page size of 50', async () => {
      await record({ spentOn: '2026-03-02' })
      await record({ spentOn: '2026-03-03' })

      const list = await request
        .withSession(admin)
        .get(`/admin/expenses?${period}&offset=1&pageSize=1`)

      expect(list.body.data).toHaveLength(1)
      expect(list.body.meta).toMatchObject({ itemCount: 2, pageSize: 1, offset: 1, hasMore: false })
    })

    it('refuses a period that starts after it ends with 400', async () => {
      const res = await request
        .withSession(admin)
        .get('/admin/expenses?from=2026-04-01&to=2026-03-01')

      expect(res.status).toBe(400)
    })

    it('refuses a missing or impossible period day with 400', async () => {
      const responses = await Promise.all([
        request.withSession(admin).get('/admin/expenses?from=2026-03-01'),
        request.withSession(admin).get('/admin/expenses?from=2026-02-30&to=2026-03-01'),
      ])

      expect(responses.map((res) => res.status)).toEqual([400, 400])
    })

    it('ignores kind and cancelsExpenseId in the body and records a plain expense', async () => {
      const original = await record()

      const res = await request
        .withSession(admin)
        .post('/admin/expenses')
        .send(expenseBody({ kind: 'cancellation', cancelsExpenseId: original.id }))

      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({
        kind: 'expense',
        cancelsExpenseId: null,
        isCancelled: false,
      })
    })
  })
})
