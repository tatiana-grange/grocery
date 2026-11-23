import type { ManualPaymentMethod, Wallet } from '@grocery/openapi-generator/client/types.gen'
import { Button } from '@grocery/ui/components/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@grocery/ui/components/primitives/dialog'
import { Input } from '@grocery/ui/components/primitives/input'
import { toast } from '@grocery/ui/components/primitives/sonner'
import { Textarea } from '@grocery/ui/components/primitives/textarea'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { refusalMessage } from '@/features/common/lib/api-error'
import { recordRefund, staffWalletQueryOptions } from '@/features/wallet/utils/wallet-queries'

const REFUND_METHODS: ManualPaymentMethod[] = ['cash', 'cheque', 'transfer']

interface RefundDialogProps {
  memberId: string
  /** The member's balance, which is also the largest refund. */
  balanceEur: number
  onClose: () => void
}

/**
 * An admin records money they gave back to a member. Nothing is sent: the admin gives the money
 * back by hand and writes it down here. The reason is required and the member reads it. The
 * amount can never be above the balance.
 */
export function RefundDialog({ memberId, balanceEur, onClose }: RefundDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<ManualPaymentMethod>('cash')
  const [reason, setReason] = useState('')

  const amountEur = Number(amount) || 0
  const tooLarge = amountEur > balanceEur
  const eur = (value: number) => t('wallet.eur', { value: value.toFixed(2) })

  const mutation = useMutation({
    mutationFn: async () =>
      recordRefund(memberId, { amountEur, paymentMethod: method, reason: reason.trim() }),
    onSuccess: (wallet: Wallet) => {
      toast.success(t('wallet.refund.success'))
      queryClient.setQueryData(staffWalletQueryOptions(memberId).queryKey, wallet)
      void queryClient.invalidateQueries({ queryKey: ['distribution'] })
      void queryClient.invalidateQueries({ queryKey: ['wallet'] })
      onClose()
    },
    onError: (error) => {
      toast.error(
        refusalMessage(error, {
          refund_exceeds_balance: t('wallet.refund.error.refund_exceeds_balance', {
            balance: eur(balanceEur),
          }),
        }) ?? t('error.default'),
      )
    },
  })

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent data-testid="wallet-refund-dialog">
        <DialogHeader>
          <DialogTitle>{t('wallet.refund.title')}</DialogTitle>
          <DialogDescription>{t('wallet.refund.description')}</DialogDescription>
        </DialogHeader>
        <p className="text-sm" data-testid="wallet-refund-balance">
          {t('wallet.refund.balance', { balance: eur(balanceEur) })}
        </p>

        <label className="flex flex-col gap-1 text-sm">
          <span>{t('wallet.refund.amount')}</span>
          <Input
            className="w-40 text-base tabular-nums"
            data-testid="wallet-refund-amount"
            type="number"
            min={0}
            step={0.01}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          {tooLarge ? (
            <span className="text-destructive" data-testid="wallet-refund-too-large">
              {t('wallet.refund.tooLarge')}
            </span>
          ) : null}
        </label>

        <fieldset className="space-y-1 text-sm">
          <legend>{t('wallet.refund.method')}</legend>
          <div className="flex gap-2">
            {REFUND_METHODS.map((candidate) => (
              <Button
                key={candidate}
                type="button"
                size="sm"
                variant={method === candidate ? 'default' : 'outline'}
                data-testid={`wallet-refund-method-${candidate}`}
                onClick={() => setMethod(candidate)}
              >
                {t(`wallet.method_.${candidate}`)}
              </Button>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1 text-sm">
          <span>{t('wallet.refund.reason')}</span>
          <Textarea
            data-testid="wallet-refund-reason"
            maxLength={500}
            placeholder={t('wallet.refund.reasonHint')}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>

        <DialogFooter>
          <Button variant="outline" data-testid="wallet-refund-cancel" onClick={onClose}>
            {t('wallet.refund.cancel')}
          </Button>
          <Button
            data-testid="wallet-refund-confirm"
            disabled={
              !(amountEur > 0) || tooLarge || reason.trim().length === 0 || mutation.isPending
            }
            onClick={() => mutation.mutate()}
          >
            {t('wallet.refund.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
