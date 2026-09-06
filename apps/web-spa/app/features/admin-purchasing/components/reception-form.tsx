import type {
  SupplierOrderDetail,
  SupplierOrderLine,
} from '@grocery/openapi-generator/client/types.gen'
import { Button } from '@grocery/ui/components/primitives/button'
import { Input } from '@grocery/ui/components/primitives/input'
import { Label } from '@grocery/ui/components/primitives/label'
import { toast } from '@grocery/ui/components/primitives/sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { handleMutationError } from '@/features/common/lib/api-error'
import { recordReception } from '@/features/admin-purchasing/utils/purchasing-queries'

interface LineDraft {
  include: boolean
  receivedQuantity: string
  unitCostEur: string
}

/** Live discrepancy hint while the staffer types, mirroring the server's `discrepancyFor`. */
function previewDiscrepancy(line: SupplierOrderLine, received: number): 'none' | 'short' | 'over' {
  const diff = received - line.quantity
  if (Math.abs(diff) < 1e-9) return 'none'
  // The precise weight-tolerance band lives on the server; here we only hint direction.
  return diff < 0 ? 'short' : 'over'
}

export function ReceptionForm({ order }: { order: SupplierOrderDetail }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [drafts, setDrafts] = useState<Record<string, LineDraft>>(() =>
    Object.fromEntries(
      order.lines.map((line) => [
        line.id,
        { include: true, receivedQuantity: String(line.quantity), unitCostEur: '' },
      ]),
    ),
  )

  const update = (id: string, patch: Partial<LineDraft>) =>
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }))

  /**
   * An included line needs a non-negative received quantity, and — when anything was
   * received — an explicit non-negative unit cost. A blank cost must never be sent as `0`:
   * it would silently drag down the product's weighted-average cost price.
   */
  const missingCost = (line: SupplierOrderLine) => {
    const draft = drafts[line.id]
    if (!draft?.include) return false
    return Number(draft.receivedQuantity || 0) > 0 && draft.unitCostEur.trim() === ''
  }

  const canSubmit = order.lines.every((line) => {
    const draft = drafts[line.id]
    if (!draft?.include) return true
    const received = Number(draft.receivedQuantity || 0)
    if (!Number.isFinite(received) || received < 0) return false
    if (received === 0) return true
    const cost = Number(draft.unitCostEur)
    return draft.unitCostEur.trim() !== '' && Number.isFinite(cost) && cost >= 0
  })

  const mutation = useMutation({
    mutationFn: () =>
      recordReception(order.id, {
        lines: order.lines
          .filter((line) => drafts[line.id]?.include)
          .map((line) => ({
            supplierOrderLineId: line.id,
            receivedQuantity: Number(drafts[line.id].receivedQuantity || 0),
            unitCostEur: Number(drafts[line.id].unitCostEur || 0),
          })),
      }),
    onSuccess: () => {
      toast.success(t('purchasing.reception.done'))
      void queryClient.invalidateQueries({ queryKey: ['admin-purchasing'] })
    },
    onError: (error) =>
      handleMutationError(error, toast.error, {
        conflict: t('purchasing.reception.notSent'),
        fallback: t('purchasing.reception.invalidValues'),
      }),
  })

  const anySelected = order.lines.some((line) => drafts[line.id]?.include)

  return (
    <form
      className="space-y-4 rounded-lg border border-border p-4"
      data-testid="reception-form"
      onSubmit={(event) => {
        event.preventDefault()
        mutation.mutate()
      }}
    >
      <h3 className="font-bold">{t('purchasing.reception.heading')}</h3>

      <div className="space-y-3">
        {order.lines.map((line) => {
          const draft = drafts[line.id]
          const received = Number(draft.receivedQuantity || 0)
          const hint = previewDiscrepancy(line, received)
          return (
            <div
              key={line.id}
              className="grid grid-cols-[auto_1fr_auto_auto] items-end gap-3"
              data-testid={`reception-line-${line.product.id}`}
            >
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.include}
                  data-testid="reception-line-include"
                  onChange={(event) => update(line.id, { include: event.target.checked })}
                />
                <span className="font-medium">{line.product.name}</span>
              </label>

              <div>
                <Label className="text-xs text-muted-foreground">
                  {t('purchasing.reception.receivedQuantity')} ({t('purchasing.columns.ordered')}{' '}
                  {line.quantity})
                </Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  disabled={!draft.include}
                  data-testid="reception-line-quantity"
                  value={draft.receivedQuantity}
                  onChange={(event) => update(line.id, { receivedQuantity: event.target.value })}
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">
                  {t('purchasing.reception.unitCost')}
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-28"
                  disabled={!draft.include}
                  data-testid="reception-line-cost"
                  value={draft.unitCostEur}
                  onChange={(event) => update(line.id, { unitCostEur: event.target.value })}
                />
              </div>

              <span
                className="pb-2 text-xs text-muted-foreground"
                data-testid="reception-line-hint"
              >
                {missingCost(line)
                  ? t('purchasing.reception.costRequired')
                  : draft.include && hint !== 'none'
                    ? t(`purchasing.discrepancy.${hint}`)
                    : ''}
              </span>
            </div>
          )
        })}
      </div>

      <Button
        type="submit"
        data-testid="reception-submit"
        disabled={!anySelected || !canSubmit || mutation.isPending}
      >
        {t('purchasing.reception.submit')}
      </Button>
    </form>
  )
}
