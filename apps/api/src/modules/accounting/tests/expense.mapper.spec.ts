import { describe, expect, it } from 'vitest'
import type { User } from '../../auth/auth.entity'
import { Expense } from '../entities/expense.entity'
import { ExpenseMapper } from '../expense.mapper'

function makeExpense(id: string): Expense {
  const expense = new Expense()
  expense.id = id
  expense.spentOn = '2026-03-10'
  expense.amountCents = 45000
  expense.category = 'rent'
  expense.label = 'March rent'
  expense.paymentMethod = 'transfer'
  expense.recordedByUser = { name: 'Ada Admin' } as User
  return expense
}

describe('ExpenseMapper', () => {
  const mapper = new ExpenseMapper()

  describe('toExpense', () => {
    it('marks an expense with a cancellation row as cancelled and points at the row', () => {
      const dto = mapper.toExpense({ expense: makeExpense('e1'), cancelledByExpenseId: 'c1' })

      expect(dto).toMatchObject({
        id: 'e1',
        kind: 'expense',
        isCancelled: true,
        cancelledByExpenseId: 'c1',
        cancelsExpenseId: null,
        recordedByName: 'Ada Admin',
      })
    })

    it('leaves an expense with no cancellation row not cancelled', () => {
      const dto = mapper.toExpense({ expense: makeExpense('e1'), cancelledByExpenseId: null })

      expect(dto).toMatchObject({ isCancelled: false, cancelledByExpenseId: null, reason: null })
    })

    it('points a cancellation row at the expense it cancels and carries the reason', () => {
      const cancellation = makeExpense('c1')
      cancellation.kind = 'cancellation'
      cancellation.cancelsExpense = makeExpense('e1')
      cancellation.reason = 'Paid twice'

      const dto = mapper.toExpense({ expense: cancellation, cancelledByExpenseId: null })

      expect(dto).toMatchObject({
        kind: 'cancellation',
        cancelsExpenseId: 'e1',
        reason: 'Paid twice',
        isCancelled: false,
      })
    })
  })

  describe('toExpenseList', () => {
    const items = [{ expense: makeExpense('e1'), cancelledByExpenseId: null }]

    it('says there is more when the page ends before the total', () => {
      const list = mapper.toExpenseList({
        items,
        total: 3,
        pagination: { pageSize: 1, offset: 1 },
      })

      expect(list.meta).toEqual({ itemCount: 3, pageSize: 1, offset: 1, hasMore: true })
    })

    it('says there is no more on the last page', () => {
      const list = mapper.toExpenseList({
        items,
        total: 2,
        pagination: { pageSize: 1, offset: 1 },
      })

      expect(list.meta.hasMore).toBe(false)
      expect(list.data).toHaveLength(1)
    })
  })
})
