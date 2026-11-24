import { createPaginationQuerySchema, paginatedSchema } from '@lonestone/nzoth/server'
import { z } from 'zod'
import { calendarDaySchema } from './accounting.contract'

export const EXPENSE_CATEGORIES = [
  'rent',
  'insurance',
  'utilities',
  'equipment',
  'bank_fees',
  'other',
] as const
export const expenseCategorySchema = z.enum(EXPENSE_CATEGORIES).meta({
  title: 'ExpenseCategory',
  description: 'The fixed list of association expense categories.',
})
export type ExpenseCategory = z.infer<typeof expenseCategorySchema>

export const EXPENSE_PAYMENT_METHODS = ['cash', 'cheque', 'transfer', 'card'] as const
export const expensePaymentMethodSchema = z.enum(EXPENSE_PAYMENT_METHODS).meta({
  title: 'ExpensePaymentMethod',
  description: 'How an association expense was paid.',
})
export type ExpensePaymentMethod = z.infer<typeof expensePaymentMethodSchema>

export const EXPENSE_KINDS = ['expense', 'cancellation'] as const
export const expenseKindSchema = z.enum(EXPENSE_KINDS).meta({
  title: 'ExpenseKind',
  description: 'A plain expense, or the reversing row that cancels one.',
})
export type ExpenseKind = z.infer<typeof expenseKindSchema>

/** Refusal codes of a cancellation, read by the client from the 409 body. */
export const EXPENSE_CANCEL_REFUSALS = ['already_cancelled', 'cannot_cancel_cancellation'] as const
export const expenseCancelRefusalSchema = z.enum(EXPENSE_CANCEL_REFUSALS).meta({
  title: 'ExpenseCancelRefusal',
  description: 'Why a cancellation was refused. Carried in the 409 body alongside statusCode.',
})
export type ExpenseCancelRefusal = z.infer<typeof expenseCancelRefusalSchema>

export const expenseSchema = z
  .object({
    id: z.string().uuid(),
    spentOn: calendarDaySchema,
    /** Positive on an expense, negative on its cancellation row. */
    amountCents: z.number().int(),
    category: expenseCategorySchema,
    label: z.string(),
    paymentMethod: expensePaymentMethodSchema,
    kind: expenseKindSchema,
    /** Set on a cancellation row: the expense it cancels. */
    cancelsExpenseId: z.string().uuid().nullable(),
    /** Set on a cancelled expense: the cancellation row that points at it. */
    cancelledByExpenseId: z.string().uuid().nullable(),
    isCancelled: z.boolean(),
    /** Set on a cancellation row only. */
    reason: z.string().nullable(),
    recordedByName: z.string(),
    createdAt: z.date(),
  })
  .meta({
    title: 'Expense',
    description:
      'An association expense, or the negative row that cancels one. Rows are never edited or deleted.',
  })
export type ExpenseDto = z.infer<typeof expenseSchema>

export const recordExpenseSchema = expenseSchema
  .pick({ spentOn: true, amountCents: true, category: true, paymentMethod: true })
  .extend({
    amountCents: z.number().int().min(1).max(2_147_483_647),
    label: z.string().trim().min(1).max(200),
  })
  .meta({
    title: 'RecordExpenseInput',
    description:
      'An expense to record. The amount is a whole number of cents, at least 1. The label is 1 to ' +
      '200 characters. Any other field is ignored.',
    examples: [
      {
        spentOn: '2026-03-10',
        amountCents: 45000,
        category: 'rent',
        label: 'March rent',
        paymentMethod: 'transfer',
      },
    ],
  })
export type RecordExpenseInput = z.infer<typeof recordExpenseSchema>

export const cancelExpenseSchema = z.object({ reason: z.string().trim().min(1).max(500) }).meta({
  title: 'CancelExpenseInput',
  description: 'Why the expense is cancelled, 1 to 500 characters.',
})
export type CancelExpenseInput = z.infer<typeof cancelExpenseSchema>

export const expenseListSchema = paginatedSchema(expenseSchema).meta({
  title: 'ExpenseList',
  description: 'A paginated page of expense rows, newest day first.',
})
export type ExpenseList = z.infer<typeof expenseListSchema>

export const expensePaginationSchema = createPaginationQuerySchema({ defaultPageSize: 50 })
export type ExpensePagination = z.infer<typeof expensePaginationSchema>
