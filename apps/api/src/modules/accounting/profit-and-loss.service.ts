import { EntityManager } from '@mikro-orm/core'
import { Injectable } from '@nestjs/common'
import {
  dayParams,
  EXPENSE_IN_PERIOD,
  FEE_PAID_IN_PERIOD,
  HANDOVER_IN_PERIOD,
  instantParams,
  LINE_COST_CENTS,
  SALE_LINES_FROM,
  SALE_MOVEMENT_REASONS,
  SALE_MOVEMENTS_FROM,
} from './accounting.queries'
import type { ExpensesByCategoryItem } from './contracts/accounting.contract'
import { EXPENSE_CATEGORIES, type ExpenseCategory } from './contracts/expense.contract'
import type { Period } from './period.util'

/** The figures of one period, as the service computes them. The mapper shapes them for the API. */
export interface ProfitAndLossFigures {
  period: Period
  salesCents: number
  costOfGoodsSoldCents: number
  grossMarginCents: number
  membershipFeesCents: number
  expensesByCategory: ExpensesByCategoryItem[]
  expensesTotalCents: number
  resultCents: number
}

/**
 * The profit-and-loss account. It only reads: handover lines, the stock movements written by
 * handovers, fee payments and expenses. It reads no wallet row, because wallet money belongs
 * to the members. Each figure is summed by the database.
 */
@Injectable()
export class ProfitAndLossService {
  constructor(private readonly em: EntityManager) {}

  async compute(period: Period): Promise<ProfitAndLossFigures> {
    const salesCents = await this.sum(
      `select coalesce(sum(hl."lineTotalAmountCents"), 0) as total
         from ${SALE_LINES_FROM} where ${HANDOVER_IN_PERIOD}`,
      instantParams(period),
    )
    const costOfGoodsSoldCents = await this.sum(
      `select coalesce(sum(${LINE_COST_CENTS}), 0) as total
         from ${SALE_MOVEMENTS_FROM} where ${SALE_MOVEMENT_REASONS} and ${HANDOVER_IN_PERIOD}`,
      instantParams(period),
    )
    const membershipFeesCents = await this.sum(
      `select coalesce(sum(mp."amountCents"), 0) as total
         from "membershipPayment" mp where ${FEE_PAID_IN_PERIOD}`,
      instantParams(period),
    )
    const expenseRows = await this.query<{ category: ExpenseCategory; total: string }>(
      `select e."category" as category, sum(e."amountCents") as total
         from "expense" e where ${EXPENSE_IN_PERIOD} group by e."category"`,
      dayParams(period),
    )
    const byCategory = new Map(expenseRows.map((row) => [row.category, Number(row.total)]))
    const expensesByCategory = EXPENSE_CATEGORIES.map((category) => ({
      category,
      amountCents: byCategory.get(category) ?? 0,
    }))
    let expensesTotalCents = 0
    for (const row of expensesByCategory) expensesTotalCents += row.amountCents

    return {
      period,
      salesCents,
      costOfGoodsSoldCents,
      grossMarginCents: salesCents - costOfGoodsSoldCents,
      membershipFeesCents,
      expensesByCategory,
      expensesTotalCents,
      resultCents: salesCents + membershipFeesCents - costOfGoodsSoldCents - expensesTotalCents,
    }
  }

  private query<T>(sql: string, params: string[]): Promise<T[]> {
    return this.em.getConnection().execute(sql, params, 'all', this.em.getTransactionContext())
  }

  private async sum(sql: string, params: string[]): Promise<number> {
    const rows = await this.query<{ total: string }>(sql, params)
    return Number(rows[0]?.total ?? 0)
  }
}
