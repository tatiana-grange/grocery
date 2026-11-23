import type { Wallet, WalletEntry } from '@grocery/openapi-generator/client/types.gen'
import { Button } from '@grocery/ui/components/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@grocery/ui/components/primitives/dialog'
import { Textarea } from '@grocery/ui/components/primitives/textarea'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@grocery/ui/components/primitives/sonner'
import { refusalMessage } from '@/features/common/lib/api-error'
import { correctPayment, staffWalletQueryOptions } from '@/features/wallet/utils/wallet-queries'

interface CorrectPaymentDialogProps {
  memberId: string
  /** The payment being corrected. */
  entry: WalletEntry
  onClose: () => void
}

/**
 * Staff reverse a payment recorded by mistake. The reason is required: it is kept on the
 * correction row and the member reads it in their history. The balance is not checked, so the
 * answer may leave the member below zero.
 */
export function CorrectPaymentDialog({ memberId, entry, onClose }: CorrectPaymentDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')

  const mutation = useMutation({
    mutationFn: async () => correctPayment(memberId, entry.id, { reason: reason.trim() }),
    onSuccess: (wallet: Wallet) => {
      toast.success(t('wallet.correct.success'))
      // The answer is this member's updated wallet: seed their cache entry. The distribution
      // screen carries the balance in another payload, and the wallet pages of the member
      // themselves are stale too.
      queryClient.setQueryData(staffWalletQueryOptions(memberId).queryKey, wallet)
      void queryClient.invalidateQueries({ queryKey: ['distribution'] })
      void queryClient.invalidateQueries({ queryKey: ['wallet'] })
      onClose()
    },
    onError: (error) => {
      toast.error(
        refusalMessage(error, {
          already_corrected: t('wallet.correct.error.already_corrected'),
          not_a_manual_payment: t('wallet.correct.error.not_a_manual_payment'),
        }) ?? t('error.default'),
      )
    },
  })

  const amount = t('wallet.eur', { value: entry.amountEur.toFixed(2) })

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent data-testid="wallet-correct-dialog">
        <DialogHeader>
          <DialogTitle>{t('wallet.correct.title')}</DialogTitle>
          <DialogDescription>{t('wallet.correct.description')}</DialogDescription>
        </DialogHeader>
        <p className="text-sm" data-testid="wallet-correct-payment">
          {t('wallet.correct.payment', {
            date: new Date(entry.createdAt).toLocaleDateString(),
            amount,
            method: entry.paymentMethod ? t(`wallet.method_.${entry.paymentMethod}`) : '',
          })}
        </p>
        <label className="flex flex-col gap-1 text-sm">
          <span>{t('wallet.correct.reason')}</span>
          <Textarea
            data-testid="wallet-correct-reason"
            maxLength={500}
            placeholder={t('wallet.correct.reasonHint')}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <DialogFooter>
          <Button variant="outline" data-testid="wallet-correct-cancel" onClick={onClose}>
            {t('wallet.correct.cancel')}
          </Button>
          <Button
            data-testid="wallet-correct-confirm"
            disabled={reason.trim().length === 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {t('wallet.correct.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
