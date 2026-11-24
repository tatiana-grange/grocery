import type { Expense } from '@grocery/openapi-generator/client/types.gen'
import { zCancelExpenseInput } from '@grocery/openapi-generator/client/zod.gen'
import { toast } from '@grocery/ui/components/primitives/sonner'
import { Textarea } from '@grocery/ui/components/primitives/textarea'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  cancelExpense,
  invalidateAccounting,
} from '@/features/admin-accounting/utils/admin-accounting-queries'
import { formatCents } from '@/features/admin-accounting/utils/accounting-format'
import { ConfirmDialog } from '@/features/common/components/confirm-dialog'
import { refusalMessage } from '@/features/common/lib/api-error'

const MAX_REASON_LENGTH = zCancelExpenseInput.shape.reason.maxLength ?? undefined

interface CancelExpenseDialogProps {
  expense: Expense
  onClose: () => void
}

/**
 * Cancelling writes a second row that reverses the expense. The expense stays in the books, and
 * the cancellation cannot be undone: an admin who cancelled by mistake records the expense again.
 */
export function CancelExpenseDialog({ expense, onClose }: CancelExpenseDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')

  const mutation = useMutation({
    mutationFn: () => cancelExpense(expense.id, reason.trim()),
    onSuccess: () => toast.success(t('adminAccounting.cancel.done')),
    onError: (error) =>
      toast.error(
        refusalMessage(error, {
          already_cancelled: t('adminAccounting.cancel.error.already_cancelled'),
          cannot_cancel_cancellation: t('adminAccounting.cancel.error.cannot_cancel_cancellation'),
        }) ?? t('error.default'),
      ),
    onSettled: () => {
      invalidateAccounting(queryClient)
      onClose()
    },
  })

  return (
    <ConfirmDialog
      testId="cancel-expense"
      title={t('adminAccounting.cancel.title')}
      description={t('adminAccounting.cancel.warning', {
        label: expense.label,
        amount: formatCents(expense.amountCents),
      })}
      descriptionTestId="cancel-expense-warning"
      backLabel={t('adminAccounting.cancel.keep')}
      confirmLabel={t('adminAccounting.cancel.confirm')}
      destructive
      confirmDisabled={reason.trim().length === 0}
      isPending={mutation.isPending}
      onConfirm={() => mutation.mutate()}
      onClose={onClose}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span>{t('adminAccounting.cancel.reason')}</span>
        <Textarea
          data-testid="cancel-expense-reason"
          maxLength={MAX_REASON_LENGTH}
          placeholder={t('adminAccounting.cancel.reasonHint')}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
    </ConfirmDialog>
  )
}
