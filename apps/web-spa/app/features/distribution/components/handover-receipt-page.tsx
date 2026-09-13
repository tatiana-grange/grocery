import { PageTitle } from '@grocery/ui/components/app'
import { Badge } from '@grocery/ui/components/primitives/badge'
import { Button } from '@grocery/ui/components/primitives/button'
import { Input } from '@grocery/ui/components/primitives/input'
import { Skeleton } from '@grocery/ui/components/primitives/skeleton'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { toast } from 'sonner'
import {
  handoverQueryOptions,
  reverseHandover,
} from '@/features/distribution/utils/distribution-queries'

/**
 * What was handed over, and the one action that can undo it.
 *
 * A reversal needs a reason, because a correction on a money ledger that nobody can explain
 * later is barely better than an edit. The original stays on screen exactly as it was — the
 * reversal is a second entry beside it, never a change to this one.
 */
export default function HandoverReceiptPage() {
  const { t } = useTranslation()
  const { handoverId = '' } = useParams()
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)
  const { data, isLoading } = useQuery(handoverQueryOptions(handoverId))

  const mutation = useMutation({
    mutationFn: async () => reverseHandover(handoverId, reason),
    onSuccess: (reversal) => {
      toast.success(
        t('distribution.handover.reverseSuccess', {
          amount: t('distribution.eur', { value: Math.abs(reversal.totalEur).toFixed(2) }),
        }),
      )
      setConfirming(false)
      void queryClient.invalidateQueries({ queryKey: ['distribution'] })
      void queryClient.invalidateQueries({ queryKey: ['wallet'] })
    },
    onError: () => toast.error(t('error.default')),
  })

  if (isLoading || !data) {
    return <Skeleton className="h-64 w-full" />
  }

  const eur = (value: number) => t('distribution.eur', { value: value.toFixed(2) })
  const isReversal = data.kind === 'reversal'

  return (
    <div className="space-y-6" data-testid="page-handover-receipt">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <PageTitle>{t('distribution.handover.receipt')}</PageTitle>
          <p className="text-sm text-muted-foreground">
            {new Date(data.createdAt).toLocaleString()}
            {data.recordedBy
              ? ` — ${t('distribution.handover.recordedBy', { name: data.recordedBy })}`
              : ''}
          </p>
        </div>
        {isReversal ? (
          <Badge variant="secondary" data-testid="handover-is-reversal">
            {t('distribution.handover.reversalOf')}
          </Badge>
        ) : null}
        {data.isReversed ? (
          <Badge variant="destructive" data-testid="handover-is-reversed">
            {t('distribution.handover.reversed')}
          </Badge>
        ) : null}
        <span className="text-2xl font-semibold tabular-nums" data-testid="handover-total">
          {eur(data.totalEur)}
        </span>
      </div>

      <ul className="divide-y divide-border rounded-lg border border-border">
        {data.lines.map((line) => (
          <li key={line.id} className="flex flex-wrap items-center gap-4 p-3 text-sm">
            <span className="min-w-40 flex-1 font-medium">{line.productName}</span>
            <span className="text-muted-foreground">
              {t('distribution.line.ordered')} {line.orderedQuantity}
            </span>
            <span>
              {t('distribution.line.handedOver')}{' '}
              <span className="tabular-nums">{line.handedQuantity}</span>
            </span>
            {line.differenceQuantity !== 0 ? (
              <span className="text-amber-600" data-testid="handover-line-difference">
                {t('distribution.handover.difference')} {line.differenceQuantity}
              </span>
            ) : null}
            <span className="tabular-nums">{eur(line.lineTotalEur)}</span>
          </li>
        ))}
      </ul>

      {data.note ? <p className="text-sm text-muted-foreground">{data.note}</p> : null}

      {!isReversal && !data.isReversed ? (
        confirming ? (
          <div className="space-y-3 rounded-lg border border-destructive/50 bg-destructive/5 p-4">
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('distribution.handover.reverseReason')}</span>
              <Input
                className="max-w-md"
                data-testid="handover-reverse-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                data-testid="handover-reverse-confirm"
                disabled={reason.trim().length === 0 || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {t('distribution.handover.reverseConfirm')}
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                {t('distribution.dismiss')}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            data-testid="handover-reverse"
            onClick={() => setConfirming(true)}
          >
            {t('distribution.handover.reverse')}
          </Button>
        )
      ) : null}
    </div>
  )
}
