import { Injectable } from '@nestjs/common'
import type { ExpenseDto, ExpenseList, ExpensePagination } from './contracts/expense.contract'
import type { ExpenseRow } from './expenses.service'

@Injectable()
export class ExpenseMapper {
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

  toExpenseList(input: {
    items: ExpenseRow[]
    total: number
    pagination: ExpensePagination
  }): ExpenseList {
    return {
      data: input.items.map((row) => this.toExpense(row)),
      meta: {
        itemCount: input.total,
        pageSize: input.pagination.pageSize,
        offset: input.pagination.offset,
        hasMore: input.pagination.offset + input.pagination.pageSize < input.total,
      },
    }
  }
}
