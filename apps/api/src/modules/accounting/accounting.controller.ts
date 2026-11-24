import {
  PaginationParams,
  TypedBody,
  TypedController,
  TypedParam,
  TypedQueryObject,
  TypedRoute,
} from '@lonestone/nzoth/server'
import { HttpCode, UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { AdminOnly, Session } from '../auth/auth.decorator'
import { LoggedInBetterAuthSession } from '../auth/auth.config'
import { AuthGuard } from '../auth/auth.guard'
import { AccountingMapper } from './accounting.mapper'
import { profitAndLossSchema } from './contracts/accounting.contract'
import { type PeriodQuery, periodQuerySchema } from './contracts/period.contract'
import {
  type CancelExpenseInput,
  cancelExpenseSchema,
  type ExpensePagination,
  expenseListSchema,
  expensePaginationSchema,
  expenseSchema,
  type RecordExpenseInput,
  recordExpenseSchema,
} from './contracts/expense.contract'
import { ExpensesService } from './expenses.service'
import { toPeriod } from './period.util'
import { ProfitAndLossService } from './profit-and-loss.service'

/** Record and list association expenses. Admins only. */
@TypedController('admin/expenses', undefined, { tags: ['Admin Expenses'] })
@UseGuards(AuthGuard)
@AdminOnly()
export class AdminExpensesController {
  constructor(
    private readonly expenses: ExpensesService,
    private readonly mapper: AccountingMapper,
  ) {}

  @TypedRoute.Get('', expenseListSchema)
  async list(
    @TypedQueryObject(periodQuerySchema) query: PeriodQuery,
    @PaginationParams(expensePaginationSchema) pagination: ExpensePagination,
  ) {
    const { items, total } = await this.expenses.list({ period: toPeriod(query), ...pagination })
    return this.mapper.toExpenseList({ items, total, pagination })
  }

  /** `kind` and `cancelsExpenseId` in the body are stripped: only the cancel route cancels. */
  @TypedRoute.Post('', expenseSchema)
  async record(
    @Session() session: LoggedInBetterAuthSession,
    @TypedBody(recordExpenseSchema) body: RecordExpenseInput,
  ) {
    return this.mapper.toExpense(await this.expenses.record(body, session.user.id))
  }

  /** The one route that cancels an expense. Final: a second call is refused. */
  @TypedRoute.Post(':expenseId/cancel', expenseSchema)
  @HttpCode(200)
  async cancel(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('expenseId', z.string().uuid()) expenseId: string,
    @TypedBody(cancelExpenseSchema) body: CancelExpenseInput,
  ) {
    const row = await this.expenses.cancel({
      expenseId,
      reason: body.reason,
      recordedByUserId: session.user.id,
    })
    return this.mapper.toExpense(row)
  }
}

/** The profit-and-loss account and the CSV exports. Admins only. */
@TypedController('admin/accounting', undefined, { tags: ['Admin Accounting'] })
@UseGuards(AuthGuard)
@AdminOnly()
export class AdminAccountingController {
  constructor(private readonly profitAndLoss: ProfitAndLossService) {}

  @TypedRoute.Get('profit-and-loss', profitAndLossSchema)
  async getProfitAndLoss(@TypedQueryObject(periodQuerySchema) query: PeriodQuery) {
    return this.profitAndLoss.compute(toPeriod(query))
  }
}
