import {
  PaginationParams,
  TypedBody,
  TypedController,
  TypedQueryObject,
  TypedRoute,
} from '@lonestone/nzoth/server'
import { UseGuards } from '@nestjs/common'
import { AdminOnly, Session } from '../auth/auth.decorator'
import { LoggedInBetterAuthSession } from '../auth/auth.config'
import { AuthGuard } from '../auth/auth.guard'
import { AccountingMapper } from './accounting.mapper'
import { type PeriodQuery, periodQuerySchema } from './contracts/accounting.contract'
import {
  type ExpensePagination,
  expenseListSchema,
  expensePaginationSchema,
  expenseSchema,
  type RecordExpenseInput,
  recordExpenseSchema,
} from './contracts/expense.contract'
import { ExpensesService } from './expenses.service'
import { toPeriod } from './period.util'

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
}
