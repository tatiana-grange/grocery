import { Badge } from '@grocery/ui/components/primitives/badge'
import { Button } from '@grocery/ui/components/primitives/button'
import { Skeleton } from '@grocery/ui/components/primitives/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@grocery/ui/components/primitives/table'
import { toast } from '@grocery/ui/components/primitives/sonner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Download, Send, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useParams } from 'react-router'
import { handleMutationError } from '@/features/common/lib/api-error'
import {
  downloadSupplierOrderExport,
  sendSupplierOrder,
  supplierOrderDetailQueryOptions,
} from '@/features/admin-purchasing/utils/purchasing-queries'

interface SkippedLine {
  productName: string
  reason: string
}

const DISCREPANCY_VARIANT = {
  none: 'outline',
  short: 'destructive',
  over: 'secondary',
} as const

export default function SupplierOrderDetailPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const location = useLocation()
  const queryClient = useQueryClient()
  const skippedLines =
    (location.state as { skippedLines?: SkippedLine[] } | null)?.skippedLines ?? []
  const { data: order, isLoading } = useQuery(supplierOrderDetailQueryOptions(id))

  const send = useMutation({
    mutationFn: (version: number) => sendSupplierOrder(id, version),
    onSuccess: () => {
      toast.success(t('purchasing.send.done'))
      void queryClient.invalidateQueries({ queryKey: ['admin-purchasing'] })
    },
    onError: (error) =>
      handleMutationError(error, toast.error, {
        conflict: t('purchasing.send.alreadySent'),
        fallback: t('purchasing.send.alreadySent'),
      }),
  })

  if (isLoading || !order) {
    return <Skeleton className="h-64 w-full" data-testid="supplier-order-detail-loading" />
  }

  return (
    <div className="space-y-6" data-testid="page-supplier-order-detail">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          render={<Link to="/admin/purchasing" />}
          data-testid="supplier-order-back"
        >
          <ArrowLeft className="mr-2 size-4" />
          {t('purchasing.backToList')}
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">{order.supplier.name}</h1>
          <p className="text-sm text-muted-foreground">
            {t('purchasing.createdAtLabel', {
              date: new Date(order.createdAt).toLocaleString(),
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" data-testid="supplier-order-status">
            {t(`purchasing.status.${order.status}`)}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            data-testid="supplier-order-export"
            onClick={() => void downloadSupplierOrderExport(order.id)}
          >
            <Download className="mr-2 size-4" />
            {t('purchasing.send.export')}
          </Button>
          {order.status === 'draft' && (
            <Button
              size="sm"
              data-testid="supplier-order-send"
              disabled={send.isPending}
              onClick={() => send.mutate(order.version)}
            >
              <Send className="mr-2 size-4" />
              {t('purchasing.send.action')}
            </Button>
          )}
        </div>
      </div>

      {skippedLines.length > 0 && (
        <div
          className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          data-testid="supplier-order-skipped"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">{t('purchasing.skipped.heading')}</p>
            <ul className="mt-1 list-inside list-disc">
              {skippedLines.map((line) => (
                <li key={line.productName}>
                  {line.productName} — {t(`purchasing.skipped.reason.${line.reason}`)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('purchasing.columns.product')}</TableHead>
              <TableHead className="text-right">{t('purchasing.columns.ordered')}</TableHead>
              <TableHead className="text-right">{t('purchasing.columns.received')}</TableHead>
              <TableHead>{t('purchasing.columns.discrepancy')}</TableHead>
              <TableHead className="text-right">{t('purchasing.columns.members')}</TableHead>
              <TableHead className="text-right">{t('purchasing.columns.unitCost')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.lines.map((line) => (
              <TableRow key={line.id} data-testid={`supplier-order-line-${line.product.id}`}>
                <TableCell className="font-medium">{line.product.name}</TableCell>
                <TableCell className="text-right tabular-nums" data-testid="line-ordered">
                  {line.quantity}
                </TableCell>
                <TableCell className="text-right tabular-nums" data-testid="line-received">
                  {line.receivedQuantity}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={DISCREPANCY_VARIANT[line.discrepancy]}
                    data-testid="line-discrepancy"
                  >
                    {t(`purchasing.discrepancy.${line.discrepancy}`)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {line.contributingMemberCount}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {line.estimatedUnitCostEur == null
                    ? t('purchasing.unknownCost')
                    : t('purchasing.estimatedTotalValue', {
                        value: line.estimatedUnitCostEur.toFixed(2),
                      })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end text-sm" data-testid="supplier-order-total">
        <span className="text-muted-foreground">
          {t('purchasing.estimatedTotalLabel')}:{' '}
          <span className="font-semibold text-foreground">
            {t('purchasing.estimatedTotalValue', { value: order.estimatedTotalEur.toFixed(2) })}
          </span>
          {order.hasUnknownCostLines ? ` — ${t('purchasing.partialEstimate')}` : ''}
        </span>
      </div>

      <section className="space-y-3" data-testid="supplier-order-receptions">
        <h2 className="text-lg font-bold">{t('purchasing.receptionsHeading')}</h2>
        {order.receptions.length === 0 ? (
          <p
            className="text-sm text-muted-foreground"
            data-testid="supplier-order-receptions-empty"
          >
            {t('purchasing.noReceptions')}
          </p>
        ) : (
          <ul className="space-y-4">
            {order.receptions.map((reception) => (
              <li
                key={reception.id}
                className="rounded-lg border border-border p-3"
                data-testid={`reception-${reception.id}`}
              >
                <p className="mb-2 text-sm font-medium">
                  {new Date(reception.receivedAt).toLocaleString()}
                </p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {reception.lines.map((line) => (
                    <li key={line.id}>
                      {line.productName}: {line.receivedQuantity} (
                      {t(`purchasing.discrepancy.${line.discrepancy}`)})
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
