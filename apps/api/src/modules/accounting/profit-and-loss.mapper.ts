import { Injectable } from '@nestjs/common'
import type { ProfitAndLoss } from './contracts/accounting.contract'
import type { ProfitAndLossFigures } from './profit-and-loss.service'

@Injectable()
export class ProfitAndLossMapper {
  toProfitAndLoss(figures: ProfitAndLossFigures): ProfitAndLoss {
    return {
      from: figures.period.from,
      to: figures.period.to,
      salesCents: figures.salesCents,
      costOfGoodsSoldCents: figures.costOfGoodsSoldCents,
      grossMarginCents: figures.grossMarginCents,
      membershipFeesCents: figures.membershipFeesCents,
      expensesByCategory: figures.expensesByCategory,
      expensesTotalCents: figures.expensesTotalCents,
      resultCents: figures.resultCents,
    }
  }
}
