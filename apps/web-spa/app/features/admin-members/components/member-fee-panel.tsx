import type { MemberDetail } from '@grocery/openapi-generator/client/types.gen'
import { Badge } from '@grocery/ui/components/primitives/badge'
import { Button } from '@grocery/ui/components/primitives/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@grocery/ui/components/primitives/dialog'
import { Input } from '@grocery/ui/components/primitives/input'
import { toast } from '@grocery/ui/components/primitives/sonner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  feePaymentsQueryOptions,
  recordFeePayment,
  setMemberFee,
} from '@/features/admin-members/utils/admin-members-queries'

export function MemberFeePanel({ member }: { member: MemberDetail }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: payments } = useQuery(feePaymentsQueryOptions(member.id))

  const [expectedEur, setExpectedEur] = useState(
    (member.fee.expectedAmountCents / 100).toString(),
  )
  const [amountEur, setAmountEur] = useState('')
  const [method, setMethod] = useState<'cash' | 'transfer' | 'other'>('cash')

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-members'] })
  }

  const setFee = useMutation({
    mutationFn: () =>
      setMemberFee(member.id, {
        expectedAmountCents: Math.round(Number(expectedEur) * 100),
        version: member.version,
      }),
    onSuccess: () => {
      toast.success(t('adminMembers.fee.saved'))
      invalidate()
    },
    onError: () => toast.error(t('adminMembers.toasts.error')),
  })

  const pay = useMutation({
    mutationFn: (kind: 'payment' | 'adjustment') =>
      recordFeePayment(member.id, {
        kind,
        amountCents: Math.round(Number(amountEur) * 100),
        method,
        paidAt: new Date().toISOString(),
      }),
    onSuccess: () => {
      toast.success(t('adminMembers.fee.recorded'))
      setAmountEur('')
      invalidate()
    },
    onError: () => toast.error(t('adminMembers.toasts.error')),
  })

  return (
    <section className="space-y-3 rounded-lg border border-border p-4" data-testid="member-fee-panel">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {t('adminMembers.fee.title')}
        </h2>
        <Badge variant="outline" data-testid="member-fee-state">
          {t(`members.feeState.${member.fee.state}`)}
        </Badge>
      </div>

      <p className="text-sm" data-testid="member-fee-summary">
        {(member.fee.paidAmountCents / 100).toFixed(2)} /{' '}
        {(member.fee.expectedAmountCents / 100).toFixed(2)} €
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">{t('adminMembers.fee.expected')}</span>
          <Input
            type="number"
            step="0.01"
            className="w-28"
            data-testid="member-fee-expected"
            value={expectedEur}
            onChange={(event) => setExpectedEur(event.target.value)}
          />
        </label>
        <Button
          size="sm"
          variant="outline"
          data-testid="member-fee-save"
          disabled={
            !Number.isFinite(Number(expectedEur)) ||
            Number(expectedEur) < 0 ||
            setFee.isPending
          }
          onClick={() => setFee.mutate()}
        >
          {t('catalog.save')}
        </Button>
      </div>

      <Dialog>
        <DialogTrigger render={<Button size="sm" data-testid="member-fee-record-open" />}>
          {t('adminMembers.fee.recordPayment')}
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('adminMembers.fee.recordPayment')}</DialogTitle>
          </DialogHeader>
          <Input
            type="number"
            step="0.01"
            data-testid="member-fee-amount"
            placeholder={t('adminMembers.fee.amount')}
            value={amountEur}
            onChange={(event) => setAmountEur(event.target.value)}
          />
          <div className="flex gap-2">
            {(['cash', 'transfer', 'other'] as const).map((option) => (
              <Button
                key={option}
                type="button"
                size="sm"
                variant={method === option ? 'default' : 'outline'}
                onClick={() => setMethod(option)}
              >
                {t(`adminMembers.fee.method.${option}`)}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t('common.cancel')}</DialogClose>
            <DialogClose
              render={<Button variant="outline" />}
              disabled={!Number(amountEur)}
              onClick={() => pay.mutate('adjustment')}
            >
              {t('adminMembers.fee.adjustment')}
            </DialogClose>
            <DialogClose
              render={<Button data-testid="member-fee-record-confirm" />}
              disabled={!(Number(amountEur) > 0)}
              onClick={() => pay.mutate('payment')}
            >
              {t('adminMembers.fee.record')}
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {payments && payments.length > 0 && (
        <ul className="space-y-1 text-sm">
          {payments.map((payment) => (
            <li key={payment.id} className="flex justify-between border-b border-border py-1">
              <span>
                {payment.kind === 'adjustment' ? '± ' : ''}
                {(payment.amountCents / 100).toFixed(2)} € ·{' '}
                {t(`adminMembers.fee.method.${payment.method}`)}
              </span>
              <span className="text-muted-foreground">
                {new Date(payment.paidAt).toLocaleDateString()} · {payment.recordedByName}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
