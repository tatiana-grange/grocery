import { Button } from '@grocery/ui/components/primitives/button'
import { Input } from '@grocery/ui/components/primitives/input'
import type { PaymentMethod, Wallet } from '@grocery/openapi-generator/client/types.gen'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { recordPayment } from '@/features/wallet/utils/wallet-queries'

const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'cheque', 'transfer']

interface RecordPaymentFormProps {
  memberId: string
  /** Prefills the amount — the shortfall, when a handover was just refused. */
  suggestedAmountEur?: number
  onRecorded: (wallet: Wallet) => void
}

/**
 * Money the member has actually handed over, entered by a human after the fact. The system
 * does not reconcile against a bank feed and does not chase an unpaid cheque — the means is
 * captured because lot 7's accounting export will need to split cash from bank.
 */
export function RecordPaymentForm({
  memberId,
  suggestedAmountEur,
  onRecorded,
}: RecordPaymentFormProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState(suggestedAmountEur ? suggestedAmountEur.toFixed(2) : '')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [note, setNote] = useState('')

  const mutation = useMutation({
    mutationFn: async () =>
      recordPayment(memberId, {
        amountEur: Number(amount) || 0,
        paymentMethod: method,
        note: note.trim() || undefined,
      }),
    onSuccess: (wallet) => {
      toast.success(
        t('wallet.success', {
          amount: t('wallet.eur', { value: (Number(amount) || 0).toFixed(2) }),
        }),
      )
      void queryClient.invalidateQueries({ queryKey: ['wallet'] })
      void queryClient.invalidateQueries({ queryKey: ['distribution'] })
      onRecorded(wallet)
    },
    onError: () => toast.error(t('error.default')),
  })

  return (
    <div className="space-y-3" data-testid="wallet-record-payment-form">
      <label className="flex flex-col gap-1 text-sm">
        <span>{t('wallet.amount')}</span>
        <Input
          className="w-40 text-base tabular-nums"
          data-testid="wallet-payment-amount"
          type="number"
          min={0}
          step={0.01}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </label>

      <fieldset className="space-y-1 text-sm">
        <legend>{t('wallet.method')}</legend>
        <div className="flex gap-2">
          {PAYMENT_METHODS.map((candidate) => (
            <Button
              key={candidate}
              type="button"
              size="sm"
              variant={method === candidate ? 'default' : 'outline'}
              data-testid={`wallet-payment-method-${candidate}`}
              onClick={() => setMethod(candidate)}
            >
              {t(`wallet.method_.${candidate}`)}
            </Button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        <span>{t('wallet.note')}</span>
        <Input
          className="max-w-sm"
          data-testid="wallet-payment-note"
          placeholder={t('wallet.noteHint')}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>

      <Button
        data-testid="wallet-payment-submit"
        disabled={!(Number(amount) > 0) || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? t('wallet.submitting') : t('wallet.submit')}
      </Button>
    </div>
  )
}
