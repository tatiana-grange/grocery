import { z } from 'zod'
import { expenseCategorySchema } from './expense.contract'
import { calendarDaySchema } from './period.contract'

export const expensesByCategoryItemSchema = z
  .object({ category: expenseCategorySchema, amountCents: z.number().int() })
  .meta({
    title: 'ExpensesByCategoryItem',
    description: 'The expenses of one category in the period, in cents.',
  })

export const profitAndLossSchema = z
  .object({
    from: calendarDaySchema,
    to: calendarDaySchema,
    /** Sum of handover line totals in the period, reversal lines included (they are negative). */
    salesCents: z.number().int(),
    /** Cost recorded on the stock movements written by handovers in the period. */
    costOfGoodsSoldCents: z.number().int(),
    /** Sales minus cost of goods sold. */
    grossMarginCents: z.number().int(),
    /** Fee payments and adjustments paid in the period. */
    membershipFeesCents: z.number().int(),
    /** All six categories, in the fixed order, with 0 when empty. */
    expensesByCategory: z.array(expensesByCategoryItemSchema),
    expensesTotalCents: z.number().int(),
    /** Sales plus fees minus cost of goods sold minus expenses. */
    resultCents: z.number().int(),
  })
  .meta({
    title: 'ProfitAndLoss',
    description:
      'The profit-and-loss account for a period. Wallet money (top-ups, payment corrections, ' +
      'refunds) is not on it: it belongs to the members. All amounts are in cents.',
  })
export type ProfitAndLoss = z.infer<typeof profitAndLossSchema>

export const EXPORT_NAMES = [
  'wallet-movements',
  'sales',
  'purchases',
  'membership-fees',
  'expenses',
] as const
export const exportNameSchema = z.enum(EXPORT_NAMES).meta({
  title: 'ExportName',
  description: 'Which CSV export to download.',
})
export type ExportName = z.infer<typeof exportNameSchema>
