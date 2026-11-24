import { EntityManager, QueryOrder } from '@mikro-orm/core'
import { Injectable } from '@nestjs/common'
import { User } from '../auth/auth.entity'
import type { ExpensePagination, RecordExpenseInput } from './contracts/expense.contract'
import { Expense } from './entities/expense.entity'
import type { Period } from './period.util'

/** An expense row, with the cancellation row that points at it, if any. */
export interface ExpenseRow {
  expense: Expense
  cancelledByExpenseId: string | null
}

/** The association expense ledger. Append-only: this service never updates or deletes a row. */
@Injectable()
export class ExpensesService {
  constructor(private readonly em: EntityManager) {}

  async record(input: RecordExpenseInput, recordedByUserId: string): Promise<ExpenseRow> {
    const expense = new Expense()
    expense.spentOn = input.spentOn
    expense.amountCents = input.amountCents
    expense.category = input.category
    expense.label = input.label
    expense.paymentMethod = input.paymentMethod
    expense.recordedByUser = this.em.getReference(User, recordedByUserId)
    this.em.persist(expense)
    await this.em.flush()
    await this.em.populate(expense, ['recordedByUser'])
    return { expense, cancelledByExpenseId: null }
  }

  /** Rows whose day is in the period, newest day first. */
  async list(p: { period: Period } & ExpensePagination): Promise<{
    items: ExpenseRow[]
    total: number
  }> {
    const [expenses, total] = await this.em.findAndCount(
      Expense,
      { spentOn: { $gte: p.period.from, $lte: p.period.to } },
      {
        orderBy: { spentOn: QueryOrder.DESC, createdAt: QueryOrder.DESC, id: QueryOrder.ASC },
        limit: p.pageSize,
        offset: p.offset,
        populate: ['recordedByUser'],
      },
    )
    const cancellations = expenses.length
      ? await this.em.find(Expense, { cancelsExpense: { $in: expenses.map((row) => row.id) } })
      : []
    const cancelledBy = new Map(cancellations.map((row) => [row.cancelsExpense!.id, row.id]))
    return {
      items: expenses.map((expense) => ({
        expense,
        cancelledByExpenseId: cancelledBy.get(expense.id) ?? null,
      })),
      total,
    }
  }
}
