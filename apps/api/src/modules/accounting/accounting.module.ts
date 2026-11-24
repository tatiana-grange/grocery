import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import { AdminAccountingController, AdminExpensesController } from './accounting.controller'
import { AccountingMapper } from './accounting.mapper'
import { Expense } from './entities/expense.entity'
import { ExpensesService } from './expenses.service'
import { ProfitAndLossService } from './profit-and-loss.service'

/**
 * Lot 7 accounting: the association expense ledger, the profit-and-loss account and the CSV
 * exports. It owns one table, `expense`, and only reads the tables of the other modules.
 */
@Module({
  imports: [MikroOrmModule.forFeature([Expense])],
  controllers: [AdminExpensesController, AdminAccountingController],
  providers: [ExpensesService, ProfitAndLossService, AccountingMapper],
})
export class AccountingModule {}
