import { Button } from '@grocery/ui/components/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@grocery/ui/components/primitives/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@grocery/ui/components/primitives/form'
import { Input } from '@grocery/ui/components/primitives/input'
import { NativeSelect } from '@grocery/ui/components/primitives/native-select'
import { toast } from '@grocery/ui/components/primitives/sonner'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { eurosToCents } from '@/features/admin-accounting/utils/accounting-format'
import {
  invalidateAccounting,
  recordExpense,
} from '@/features/admin-accounting/utils/admin-accounting-queries'
import {
  createExpenseFormSchema,
  EXPENSE_CATEGORY_OPTIONS,
  EXPENSE_METHOD_OPTIONS,
  type ExpenseFormValues,
  MAX_EXPENSE_LABEL_LENGTH,
} from '@/features/admin-accounting/utils/expense-form'
import { toDateInput } from '@/features/common/lib/date-input'

interface RecordExpenseDialogProps {
  onClose: () => void
}

/** Records one association expense. The amount is typed in euros and sent as whole cents. */
export function RecordExpenseDialog({ onClose }: RecordExpenseDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(createExpenseFormSchema(t)),
    defaultValues: {
      spentOn: toDateInput(new Date()),
      amount: '',
      category: 'other',
      label: '',
      paymentMethod: 'transfer',
    },
  })

  const mutation = useMutation({
    mutationFn: (values: ExpenseFormValues) =>
      recordExpense({
        spentOn: values.spentOn,
        amountCents: eurosToCents(values.amount),
        category: values.category,
        label: values.label.trim(),
        paymentMethod: values.paymentMethod,
      }),
    onSuccess: () => {
      toast.success(t('adminAccounting.form.recorded'))
      invalidateAccounting(queryClient)
      onClose()
    },
    onError: () => toast.error(t('error.default')),
  })

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent data-testid="expense-form-dialog">
        <DialogHeader>
          <DialogTitle>{t('adminAccounting.form.title')}</DialogTitle>
          <DialogDescription>{t('adminAccounting.form.description')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <FormField
              control={form.control}
              name="spentOn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('adminAccounting.form.date')}</FormLabel>
                  <FormControl>
                    <Input type="date" data-testid="expense-form-date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('adminAccounting.form.amount')}</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="decimal"
                      className="w-40 tabular-nums"
                      data-testid="expense-form-amount"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('adminAccounting.form.category')}</FormLabel>
                  <FormControl>
                    <NativeSelect data-testid="expense-form-category" {...field}>
                      {EXPENSE_CATEGORY_OPTIONS.map((category) => (
                        <option key={category} value={category}>
                          {t(`adminAccounting.category.${category}`)}
                        </option>
                      ))}
                    </NativeSelect>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('adminAccounting.form.label')}</FormLabel>
                  <FormControl>
                    <Input
                      maxLength={MAX_EXPENSE_LABEL_LENGTH}
                      data-testid="expense-form-label"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('adminAccounting.form.method')}</FormLabel>
                  <FormControl>
                    <NativeSelect data-testid="expense-form-method" {...field}>
                      {EXPENSE_METHOD_OPTIONS.map((method) => (
                        <option key={method} value={method}>
                          {t(`adminAccounting.method.${method}`)}
                        </option>
                      ))}
                    </NativeSelect>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                data-testid="expense-form-cancel"
                onClick={onClose}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" data-testid="expense-form-submit" disabled={mutation.isPending}>
                {t('adminAccounting.form.submit')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
