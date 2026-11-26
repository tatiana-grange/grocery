import { zRecordExpenseInput } from '@grocery/openapi-generator/client/zod.gen'
import type { TFunction } from 'i18next'
import { z } from 'zod'
import { eurosToCents } from '@/features/admin-accounting/utils/accounting-format'

function requireBound(bound: number | null | undefined, name: string): number {
  if (bound == null) throw new Error(`The API expense contract has no bound for ${name}`)
  return bound
}

export const MAX_EXPENSE_LABEL_LENGTH = requireBound(
  zRecordExpenseInput.shape.label.maxLength,
  'label',
)
const MAX_AMOUNT_CENTS = requireBound(zRecordExpenseInput.shape.amountCents.maxValue, 'amountCents')

export const EXPENSE_CATEGORY_OPTIONS = zRecordExpenseInput.shape.category.options
export const EXPENSE_METHOD_OPTIONS = zRecordExpenseInput.shape.paymentMethod.options

/** The form holds plain text, as the inputs do. The amount is in euros and becomes cents on send. */
export interface ExpenseFormValues {
  spentOn: string
  amount: string
  category: (typeof EXPENSE_CATEGORY_OPTIONS)[number]
  label: string
  paymentMethod: (typeof EXPENSE_METHOD_OPTIONS)[number]
}

export function createExpenseFormSchema(
  t: TFunction,
): z.ZodType<ExpenseFormValues, ExpenseFormValues> {
  return z.object({
    spentOn: z.string().min(1, t('adminAccounting.form.error.date')),
    amount: z
      .string()
      .trim()
      .regex(/^\d+([.,]\d{1,2})?$/, t('adminAccounting.form.error.amount'))
      .refine((value) => {
        const cents = eurosToCents(value)
        return cents >= 1 && cents <= MAX_AMOUNT_CENTS
      }, t('adminAccounting.form.error.amount')),
    category: z.enum(EXPENSE_CATEGORY_OPTIONS),
    label: z
      .string()
      .trim()
      .min(1, t('adminAccounting.form.error.label', { max: MAX_EXPENSE_LABEL_LENGTH }))
      .max(
        MAX_EXPENSE_LABEL_LENGTH,
        t('adminAccounting.form.error.label', { max: MAX_EXPENSE_LABEL_LENGTH }),
      ),
    paymentMethod: z.enum(EXPENSE_METHOD_OPTIONS),
  })
}
