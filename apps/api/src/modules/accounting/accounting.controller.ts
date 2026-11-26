import {
  PaginationParams,
  TypedBody,
  TypedController,
  TypedParam,
  TypedQueryObject,
  TypedRoute,
} from '@lonestone/nzoth/server'
import { HttpCode, StreamableFile, UseGuards } from '@nestjs/common'
import { ApiOkResponse, ApiProduces } from '@nestjs/swagger'
import { z } from 'zod'
import { AdminOnly, Session } from '../auth/auth.decorator'
import { LoggedInBetterAuthSession } from '../auth/auth.config'
import { AuthGuard } from '../auth/auth.guard'
import { ExpenseMapper } from './expense.mapper'
import {
  exportNameSchema,
  type ExportName,
  type ProfitAndLoss,
  profitAndLossSchema,
} from './contracts/accounting.contract'
import { type PeriodQuery, periodQuerySchema } from './contracts/period.contract'
import {
  type CancelExpenseInput,
  type ExpenseDto,
  type ExpenseList,
  cancelExpenseSchema,
  type ExpensePagination,
  expenseListSchema,
  expensePaginationSchema,
  expenseSchema,
  type RecordExpenseInput,
  recordExpenseSchema,
} from './contracts/expense.contract'
import { ExpensesService } from './expenses.service'
import { ExportsService } from './exports.service'
import { toPeriod } from './period.util'
import { ProfitAndLossMapper } from './profit-and-loss.mapper'
import { ProfitAndLossService } from './profit-and-loss.service'

/** Record and list association expenses. Admins only. */
@TypedController('admin/expenses', undefined, { tags: ['Admin Expenses'] })
@UseGuards(AuthGuard)
@AdminOnly()
export class AdminExpensesController {
  constructor(
    private readonly expenses: ExpensesService,
    private readonly mapper: ExpenseMapper,
  ) {}

  @TypedRoute.Get('', expenseListSchema)
  async list(
    @TypedQueryObject(periodQuerySchema) query: PeriodQuery,
    @PaginationParams(expensePaginationSchema) pagination: ExpensePagination,
  ): Promise<ExpenseList> {
    const { items, total } = await this.expenses.list({ period: toPeriod(query), ...pagination })
    return this.mapper.toExpenseList({ items, total, pagination })
  }

  /** `kind` and `cancelsExpenseId` in the body are stripped: only the cancel route cancels. */
  @TypedRoute.Post('', expenseSchema)
  async record(
    @Session() session: LoggedInBetterAuthSession,
    @TypedBody(recordExpenseSchema) body: RecordExpenseInput,
  ): Promise<ExpenseDto> {
    return this.mapper.toExpense(await this.expenses.record(body, session.user.id))
  }

  /** The one route that cancels an expense. Final: a second call is refused. */
  @TypedRoute.Post(':expenseId/cancel', expenseSchema)
  @HttpCode(200)
  async cancel(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('expenseId', z.string().uuid()) expenseId: string,
    @TypedBody(cancelExpenseSchema) body: CancelExpenseInput,
  ): Promise<ExpenseDto> {
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
  constructor(
    private readonly profitAndLoss: ProfitAndLossService,
    private readonly exports: ExportsService,
    private readonly mapper: ProfitAndLossMapper,
  ) {}

  @TypedRoute.Get('profit-and-loss', profitAndLossSchema)
  async getProfitAndLoss(
    @TypedQueryObject(periodQuerySchema) query: PeriodQuery,
  ): Promise<ProfitAndLoss> {
    return this.mapper.toProfitAndLoss(await this.profitAndLoss.compute(toPeriod(query)))
  }

  /**
   * One CSV file for the period. A whole file in one answer, not a page. No response schema: the
   * body is text, so the route is a plain NestJS route and no JSON check runs on it.
   */
  @TypedRoute.Get('exports/:exportName')
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description: 'The CSV file, with a header row. UTF-8, comma separated, CRLF line ends.',
    content: { 'text/csv': { schema: { type: 'string' } } },
  })
  async downloadExport(
    @TypedParam('exportName', exportNameSchema) exportName: ExportName,
    @TypedQueryObject(periodQuerySchema) query: PeriodQuery,
  ): Promise<StreamableFile> {
    const { fileName, csv } = await this.exports.build({
      exportName,
      period: toPeriod(query),
    })
    return new StreamableFile(Buffer.from(csv, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${fileName}"`,
    })
  }
}
