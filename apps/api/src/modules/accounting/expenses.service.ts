import { EntityManager, QueryOrder, UniqueConstraintViolationException } from '@mikro-orm/core'
import { Injectable, NotFoundException } from '@nestjs/common'
import { refusal } from '../../common/refusal'
import { User } from '../auth/auth.entity'
import type {
  ExpenseCancelRefusal,
  ExpensePagination,
  RecordExpenseInput,
} from './contracts/expense.contract'
import { Expense } from './entities/expense.entity'
import { type Period, toParisDay } from './period.util'

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

  /**
   * Writes the row that cancels an expense. The cancellation is dated the Paris day of `now`, so
   * a P&L already given for a past period never changes. This is the only way an expense becomes
   * cancelled, and it is final: the unique index on `cancelsExpenseId` backs the checks below.
   */
  async cancel(p: {
    expenseId: string
    reason: string
    recordedByUserId: string
    now?: Date
  }): Promise<ExpenseRow> {
    const now = p.now ?? new Date()
    try {
      return await this.em.transactional(async (tem) => {
        const expense = await tem.findOne(
          Expense,
          { id: p.expenseId },
          { populate: ['recordedByUser'] },
        )
        if (!expense) throw new NotFoundException('Expense not found')
        if (expense.kind === 'cancellation') {
          throw refusal(
            'cannot_cancel_cancellation' satisfies ExpenseCancelRefusal,
            'A cancellation cannot itself be cancelled',
          )
        }
        if (await tem.count(Expense, { cancelsExpense: expense.id })) throw this.alreadyCancelled()

        const cancellation = new Expense()
        cancellation.spentOn = toParisDay(now)
        cancellation.amountCents = -expense.amountCents
        cancellation.category = expense.category
        cancellation.label = expense.label
        cancellation.paymentMethod = expense.paymentMethod
        cancellation.kind = 'cancellation'
        cancellation.cancelsExpense = expense
        cancellation.reason = p.reason
        cancellation.recordedByUser = tem.getReference(User, p.recordedByUserId)
        cancellation.createdAt = now
        tem.persist(cancellation)
        await tem.flush()
        return { expense, cancelledByExpenseId: cancellation.id }
      })
    } catch (error) {
      if (error instanceof UniqueConstraintViolationException) throw this.alreadyCancelled()
      throw error
    }
  }

  private alreadyCancelled() {
    return refusal(
      'already_cancelled' satisfies ExpenseCancelRefusal,
      'This expense was already cancelled',
    )
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
