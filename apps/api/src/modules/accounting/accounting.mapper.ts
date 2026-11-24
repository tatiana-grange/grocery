import { Injectable } from '@nestjs/common'
import type { ExpenseDto, ExpenseList, ExpensePagination } from './contracts/expense.contract'
import type { ExpenseRow } from './expenses.service'

/** Turns expense rows into the contracts the controllers return. */
@Injectable()
export class AccountingMapper {
  /** The user who recorded the row must be loaded. */
  toExpense({ expense, cancelledByExpenseId }: ExpenseRow): ExpenseDto {
    return {
      id: expense.id,
      spentOn: expense.spentOn,
      amountCents: expense.amountCents,
      category: expense.category,
      label: expense.label,
      paymentMethod: expense.paymentMethod,
      kind: expense.kind,
      cancelsExpenseId: expense.cancelsExpense?.id ?? null,
      cancelledByExpenseId,
      isCancelled: cancelledByExpenseId !== null,
      reason: expense.reason ?? null,
      recordedByName: expense.recordedByUser.name,
      createdAt: expense.createdAt,
    }
  }

  toExpenseList(p: {
    items: ExpenseRow[]
    total: number
    pagination: ExpensePagination
  }): ExpenseList {
    return {
      data: p.items.map((row) => this.toExpense(row)),
      meta: {
        itemCount: p.total,
        pageSize: p.pagination.pageSize,
        offset: p.pagination.offset,
        hasMore: p.pagination.offset + p.pagination.pageSize < p.total,
      },
    }
  }
}
