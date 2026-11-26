import { type EntityManager, UniqueConstraintViolationException } from '@mikro-orm/core'
import { beforeEach, describe, expect, it } from 'vitest'
import { initializeTestApp } from '../../../test/helpers/test-app.helper'
import {
  createRequest,
  createSessionFromUser,
  type TestRequest,
} from '../../../test/helpers/test-auth.helper'
import { createMemberData } from '../../members/members.factory'
import { AccountingModule } from '../accounting.module'
import { Expense } from '../entities/expense.entity'
import { insertExpenseCancellation } from './accounting-test-data'

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
      const listed = await request.get(`/admin/expenses?${period}`)
      const recorded = await request.post('/admin/expenses').send(expenseBody())

      expect([listed.status, recorded.status]).toEqual([401, 401])
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
      const missing = await request.withSession(admin).get('/admin/expenses?from=2026-03-01')
      const impossible = await request
        .withSession(admin)
        .get('/admin/expenses?from=2026-02-30&to=2026-03-01')

      expect([missing.status, impossible.status]).toEqual([400, 400])
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

  describe('cancel', () => {
    const wide = 'from=2026-01-01&to=2099-12-31'

    async function cancel(expenseId: string, reason: unknown = 'Paid twice') {
      return request.withSession(admin).post(`/admin/expenses/${expenseId}/cancel`).send({ reason })
    }

    async function listAll() {
      const res = await request.withSession(admin).get(`/admin/expenses?${wide}`)
      return res.body.data as {
        id: string
        kind: string
        amountCents: number
        spentOn: string
        cancelsExpenseId: string | null
        cancelledByExpenseId: string | null
        isCancelled: boolean
        reason: string | null
        category: string
        label: string
        paymentMethod: string
      }[]
    }

    it('cancelling an expense writes a reversing row that names it and carries the reason', async () => {
      const original = await record()

      const res = await cancel(original.id, '  Paid twice  ')

      expect(res.status).toBe(200)
      const rows = await listAll()
      const cancellations = rows.filter((row) => row.kind === 'cancellation')
      expect(cancellations).toHaveLength(1)
      expect(cancellations[0]).toMatchObject({
        cancelsExpenseId: original.id,
        amountCents: -45000,
        reason: 'Paid twice',
        category: 'rent',
        label: 'March rent',
        paymentMethod: 'transfer',
        isCancelled: false,
        cancelledByExpenseId: null,
      })
    })

    it('answers the expense, now cancelled, and the list shows both rows', async () => {
      const original = await record()

      const res = await cancel(original.id)

      expect(res.body).toMatchObject({
        id: original.id,
        kind: 'expense',
        amountCents: 45000,
        isCancelled: true,
      })
      expect(res.body.cancelledByExpenseId).toEqual(expect.any(String))
      const rows = await listAll()
      expect(rows).toHaveLength(2)
      expect(rows.find((row) => row.id === original.id)).toMatchObject({
        isCancelled: true,
        cancelledByExpenseId: res.body.cancelledByExpenseId,
      })
    })

    it.each([
      ['an empty reason', ''],
      ['a blank reason', '   '],
      ['a reason of 501 characters', 'x'.repeat(501)],
      ['a null reason', null],
    ])('rejects %s with 400 and writes nothing', async (_name, reason) => {
      const original = await record()

      const res = await cancel(original.id, reason)

      expect(res.status).toBe(400)
      expect(await listAll()).toHaveLength(1)
    })

    it('answers 404 for an unknown expense', async () => {
      const res = await cancel('2f8b3c1e-5d6a-4b7c-8d9e-0a1b2c3d4e5f')

      expect(res.status).toBe(404)
    })

    it('refuses a member and a distributor with 403, and no session with 401', async () => {
      const original = await record()
      const url = `/admin/expenses/${original.id}/cancel`

      const statuses = [
        (await request.withSession(member).post(url).send({ reason: 'x' })).status,
        (await request.withSession(distributor).post(url).send({ reason: 'x' })).status,
        (await request.post(url).send({ reason: 'x' })).status,
      ]

      expect(statuses).toEqual([403, 403, 401])
      expect(await listAll()).toHaveLength(1)
    })

    describe('the closed doors of the final state', () => {
      it('has no PUT, PATCH or DELETE route on an expense', async () => {
        const original = await record()
        const url = `/admin/expenses/${original.id}`
        const as = request.withSession(admin)

        const statuses = [
          (await as.put(url).send(expenseBody())).status,
          (await as.patch(url).send(expenseBody())).status,
          (await as.del(url)).status,
        ]

        expect(statuses).toEqual([404, 404, 404])
        expect(await listAll()).toHaveLength(1)
      })

      it('refuses to cancel a cancellation row with cannot_cancel_cancellation', async () => {
        const original = await record()
        await cancel(original.id)
        const cancellation = (await listAll()).find((row) => row.kind === 'cancellation')!

        const res = await cancel(cancellation.id)

        expect(res.status).toBe(409)
        expect(res.body).toMatchObject({ code: 'cannot_cancel_cancellation' })
        expect(await listAll()).toHaveLength(2)
      })

      it('refuses a second cancel with already_cancelled and keeps one cancellation row', async () => {
        const original = await record()
        await cancel(original.id)

        const res = await cancel(original.id, 'Again')

        expect(res.status).toBe(409)
        expect(res.body).toMatchObject({ code: 'already_cancelled' })
        const rows = await listAll()
        expect(rows.filter((row) => row.kind === 'cancellation')).toHaveLength(1)
      })

      it('refuses, in the database, a second row that cancels the same expense', async () => {
        const original = await record()
        await cancel(original.id)
        const row = await em.fork().findOneOrFail(Expense, { id: original.id })

        await expect(
          insertExpenseCancellation(em.fork(), {
            original: row,
            recordedBy: row.recordedByUser,
            spentOn: '2026-11-24',
          }),
        ).rejects.toBeInstanceOf(UniqueConstraintViolationException)
      })

      it('turns a cancellation row that already exists into already_cancelled', async () => {
        const original = await record()
        const row = await em.fork().findOneOrFail(Expense, { id: original.id })
        await insertExpenseCancellation(em.fork(), {
          original: row,
          recordedBy: row.recordedByUser,
          spentOn: '2026-11-24',
          reason: 'By hand',
        })

        const res = await cancel(original.id)

        expect(res.status).toBe(409)
        expect(res.body).toMatchObject({ code: 'already_cancelled' })
        const rows = await listAll()
        expect(rows.filter((r) => r.kind === 'cancellation')).toHaveLength(1)
      })
    })
  })
})
