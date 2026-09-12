import { Button } from '@grocery/ui/components/primitives/button'
import { useTranslation } from 'react-i18next'
import { RecordPaymentForm } from '@/features/wallet/components/record-payment-form'

interface InsufficientBalanceDialogProps {
  memberId: string
  shortfallEur?: number
  onPaid: () => void
  onDismiss: () => void
}

/**
 * What the table does when a handover costs more than the balance: show how much is short,
 * take the payment, and let staff validate the same handover again without rebuilding it
 * (FR-028, SC-011). The balance can never go negative, so this is the only way forward
 * besides handing over less.
 */
export function InsufficientBalanceDialog({
  memberId,
  shortfallEur,
  onPaid,
  onDismiss,
}: InsufficientBalanceDialogProps) {
  const { t } = useTranslation()
  return (
    <div
      className={`space-y-4 rounded-lg border p-4 ${
        shortfallEur == null ? 'border-border' : 'border-destructive/50 bg-destructive/5'
      }`}
      data-testid="insufficient-balance-dialog"
    >
      <div className="flex items-start gap-3">
        <p className="flex-1 text-sm font-medium">
          {shortfallEur == null
            ? t('wallet.recordPayment')
            : t('distribution.refusal.insufficient_balance', {
                amount: t('distribution.eur', { value: shortfallEur.toFixed(2) }),
              })}
        </p>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          {t('distribution.dismiss')}
        </Button>
      </div>
      <RecordPaymentForm
        memberId={memberId}
        suggestedAmountEur={shortfallEur}
        onRecorded={onPaid}
      />
    </div>
  )
}
