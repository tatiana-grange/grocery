import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import { AdminAccountingController, AdminExpensesController } from './accounting.controller'
import { ExpenseMapper } from './expense.mapper'
import { Expense } from './entities/expense.entity'
import { ExpensesService } from './expenses.service'
import { ExportsService } from './exports.service'
import { ProfitAndLossMapper } from './profit-and-loss.mapper'
import { ProfitAndLossService } from './profit-and-loss.service'

/**
 * The accounting module: the association expense ledger, the profit-and-loss account and the CSV
 * exports. It owns one table, `expense`, and only reads the tables of the other modules.
 */
@Module({
  imports: [MikroOrmModule.forFeature([Expense])],
  controllers: [AdminExpensesController, AdminAccountingController],
  providers: [
    ExpensesService,
    ProfitAndLossService,
    ExportsService,
    ExpenseMapper,
    ProfitAndLossMapper,
  ],
})
export class AccountingModule {}
