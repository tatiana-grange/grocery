import { Button } from '@grocery/ui/components/primitives/button'
import { useTranslation } from 'react-i18next'
import { DistributionNotice } from '@/features/distribution/components/distribution-notice'
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
 * (FR-028, SC-011). A balance below zero (after a payment correction) lands here too: the
 * shortfall then includes the debt, and taking payment is the way forward besides handing
 * over less.
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
      className="space-y-4 rounded-xl border-2 border-border bg-card p-5"
      data-testid="insufficient-balance-dialog"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {shortfallEur == null ? (
            <p className="font-serif text-xl font-semibold">{t('wallet.recordPayment')}</p>
          ) : (
            <DistributionNotice tone="warning">
              {t('distribution.refusal.insufficient_balance', {
                amount: t('distribution.eur', { value: shortfallEur.toFixed(2) }),
              })}
            </DistributionNotice>
          )}
        </div>
        <Button variant="outline" onClick={onDismiss}>
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
