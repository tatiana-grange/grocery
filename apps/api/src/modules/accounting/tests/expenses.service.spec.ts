import type { EntityManager, MikroORM } from '@mikro-orm/core'
import { SqlEntityManager } from '@mikro-orm/postgresql'
import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest'
import { cleanupTestOrm, createTestOrm } from '../../../test/helpers/test-db.helper'
import { createMemberData } from '../../members/members.factory'
import type { ExpenseCancelRefusal } from '../contracts/expense.contract'
import { Expense } from '../entities/expense.entity'
import { ExpensesService } from '../expenses.service'

describe('ExpensesService.cancel', () => {
  let orm: MikroORM
  let em: EntityManager
  let service: ExpensesService
  let adminId: string

  beforeEach(async () => {
    orm = (await createTestOrm(inject('pgConfig'))).orm
    em = orm.em.fork()
    service = new ExpensesService(em)
    const admin = await createMemberData(em, {
      user: {
        name: 'Ada Admin',
        email: `admin-${Math.random().toString(36).slice(2)}@example.com`,
      },
      roles: ['member', 'admin'],
      status: 'active',
    })
    adminId = admin.user.id
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await cleanupTestOrm(orm)
  })

  async function recordRent(): Promise<string> {
    const { expense } = await service.record(
      {
        spentOn: '2026-03-10',
        amountCents: 45000,
        category: 'rent',
        label: 'March rent',
        paymentMethod: 'transfer',
      },
      adminId,
    )
    return expense.id
  }

  const cancellations = () => em.fork().find(Expense, { kind: 'cancellation' })

  it.each([
    ['the evening before, in summer time', '2026-03-31T22:30:00Z', '2026-04-01'],
    ['the evening before, in winter time', '2026-01-15T23:30:00Z', '2026-01-16'],
    ['the middle of the day', '2026-07-01T10:00:00Z', '2026-07-01'],
  ])('dates the cancellation the Paris day of now: %s', async (_name, now, expectedDay) => {
    const expenseId = await recordRent()

    const { cancelledByExpenseId } = await service.cancel({
      expenseId,
      reason: 'Paid twice',
      recordedByUserId: adminId,
      now: new Date(now),
    })

    const [cancellation] = await cancellations()
    expect(cancellation.id).toBe(cancelledByExpenseId)
    expect(cancellation.spentOn).toBe(expectedDay)
    expect(cancellation.spentOn).not.toBe('2026-03-10')
  })

  it('turns a unique-index violation into already_cancelled when two cancels run together', async () => {
    const expenseId = await recordRent()
    await service.cancel({ expenseId, reason: 'First', recordedByUserId: adminId })
    // The second admin's check ran before the first cancellation was written: it saw nothing.
    vi.spyOn(SqlEntityManager.prototype, 'count').mockResolvedValueOnce(0)

    const second = service.cancel({ expenseId, reason: 'Second', recordedByUserId: adminId })

    await expect(second).rejects.toMatchObject({
      response: { code: 'already_cancelled' satisfies ExpenseCancelRefusal },
      status: 409,
    })
    expect(await cancellations()).toHaveLength(1)
  })
})
