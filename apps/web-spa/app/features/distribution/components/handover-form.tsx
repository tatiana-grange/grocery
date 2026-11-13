import { Button } from '@grocery/ui/components/primitives/button'
import { Input } from '@grocery/ui/components/primitives/input'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type {
  DistributionLine,
  DistributionOrder,
} from '@grocery/openapi-generator/client/types.gen'
import { recordHandover } from '@/features/distribution/utils/distribution-queries'

interface HandoverFormProps {
  order: DistributionOrder
  onRecorded: (handoverId: string) => void
  /** Raised when the balance is short, so the page can offer to take the payment. */
  onInsufficientBalance: (shortfallEur: number | undefined) => void
}

/**
 * The 409 body the distribution controller returns. `unwrap` throws the parsed body
 * directly, so the caught error *is* this shape.
 */
interface RefusalBody {
  code?: string
  shortfallEur?: number
  productName?: string
}

/** A line this handover can cover: its goods are here, and nobody has handed it over yet. */
function isHandable(line: DistributionLine): boolean {
  return line.isReady && !line.isHandedOver
}

/**
 * The line-by-line handover. Every quantity starts at what was ordered, because that is what
 * usually leaves the table; staff correct the ones that differ — a weighed product, a
 * declined item, a short delivery.
 *
 * Only the handable lines are sent. An order whose goods arrive in two deliveries is handed
 * over in two passes (FR-008): the first takes the lines that are here, the order stays
 * outstanding for the rest, and a line already given is shown but never sent again — a line
 * is charged once, and the server refuses a second attempt.
 *
 * The total is recomputed here at the order's snapshot prices so it matches what the server
 * will charge, and the member sees the figure before anyone commits to it.
 */
export function HandoverForm({ order, onRecorded, onInsufficientBalance }: HandoverFormProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  // Only what staff typed. A line whose default still stands is not in here, so a line that
  // becomes handable after a reload starts at its ordered quantity rather than at zero.
  const [editedQuantities, setEditedQuantities] = useState<Record<string, string>>({})
  const [refusal, setRefusal] = useState<RefusalBody | null>(null)

  const handableLines = order.lines.filter(isHandable)
  const eur = (value: number) => t('distribution.eur', { value: value.toFixed(2) })
  const inputValue = (line: DistributionLine) =>
    editedQuantities[line.orderLineId] ?? String(line.orderedQuantity)
  const quantityOf = (line: DistributionLine) => Number(inputValue(line)) || 0

  const totalEur = handableLines.reduce(
    (sum, line) => sum + quantityOf(line) * line.unitPriceEur,
    0,
  )

  const mutation = useMutation({
    mutationFn: async () =>
      recordHandover(order.id, {
        version: order.version,
        lines: handableLines.map((line) => ({
          orderLineId: line.orderLineId,
          handedQuantity: quantityOf(line),
        })),
      }),
    onSuccess: (handover) => {
      setRefusal(null)
      setEditedQuantities({})
      toast.success(t('distribution.handover.success', { amount: eur(handover.totalEur) }))
      void queryClient.invalidateQueries({ queryKey: ['distribution'] })
      // The charge just moved the balance, and the wallet panel on this page reads it from
      // its own query.
      void queryClient.invalidateQueries({ queryKey: ['wallet'] })
      onRecorded(handover.id)
    },
    onError: (error: unknown) => {
      const body = (error as RefusalBody | undefined) ?? {}
      setRefusal(body)
      if (body.code === 'insufficient_balance') onInsufficientBalance(body.shortfallEur)
    },
  })

  return (
    <div className="space-y-4 p-4">
      <ul className="space-y-3">
        {order.lines.map((line) => (
          <li
            key={line.orderLineId}
            data-testid={`handover-line-${line.orderLineId}`}
            className="flex flex-wrap items-center gap-3"
          >
            <span className="min-w-40 flex-1 font-medium">{line.productName}</span>
            <span className="text-sm text-muted-foreground">
              {t('distribution.line.ordered')} {line.orderedQuantity}
            </span>
            {isHandable(line) ? (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{t('distribution.line.handedOver')}</span>
                  <Input
                    className="w-28 text-base tabular-nums"
                    data-testid="handover-qty"
                    type="number"
                    min={0}
                    step={line.saleMode === 'weight' ? 0.001 : 1}
                    value={inputValue(line)}
                    onChange={(event) =>
                      setEditedQuantities((current) => ({
                        ...current,
                        [line.orderLineId]: event.target.value,
                      }))
                    }
                  />
                </label>
                <span className="tabular-nums">{eur(quantityOf(line) * line.unitPriceEur)}</span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground" data-testid="handover-excluded">
                {line.isHandedOver
                  ? t('distribution.line.alreadyHandedOver')
                  : t(`distribution.notReadyReason.${line.notReadyReason}`)}
              </span>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-4 border-t border-border pt-4">
        <span className="text-sm text-muted-foreground">
          {t('distribution.member.aboutToCharge')}
        </span>
        <span className="text-xl font-semibold tabular-nums" data-testid="handover-total">
          {eur(totalEur)}
        </span>
        <Button
          className="ml-auto"
          data-testid="handover-submit"
          disabled={!order.hasHandableLine || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending
            ? t('distribution.handover.validating')
            : t('distribution.handover.validate')}
        </Button>
      </div>

      {refusal ? (
        <p className="text-sm text-destructive" data-testid="handover-refusal">
          {t(`distribution.refusal.${refusal.code ?? 'order_not_pending'}`, {
            amount: refusal.shortfallEur == null ? '' : eur(refusal.shortfallEur),
            productName: refusal.productName ?? '',
          })}
        </p>
      ) : null}
    </div>
  )
}
