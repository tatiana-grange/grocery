import { SectionTitle } from '@grocery/ui/components/app'
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
import { ArrowLeft, Download, Send, TriangleAlert, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useParams } from 'react-router'
import { SupplierOrderStatusBadge } from '@/features/admin-purchasing/components/supplier-order-status-badge'
import { BackOfficePageHead } from '@/features/common/components/back-office-page-head'
import {
  BackOfficeStatusBadge,
  type StatusTone,
} from '@/features/common/components/back-office-status-badge'
import { BackOfficeTableFrame } from '@/features/common/components/back-office-table-frame'
import { handleMutationError, refusalMessage } from '@/features/common/lib/api-error'
import {
  closeSupplierOrder,
  downloadSupplierOrderExport,
  sendSupplierOrder,
  supplierOrderDetailQueryOptions,
} from '@/features/admin-purchasing/utils/purchasing-queries'
import { ReceptionForm } from '@/features/admin-purchasing/components/reception-form'

interface SkippedLine {
  productName: string
  reason: string
}

const DISCREPANCY_TONE: Record<'none' | 'short' | 'over', StatusTone> = {
  none: 'positive',
  short: 'negative',
  over: 'attention',
}

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
    onSuccess: (sent) => {
      toast.success(
        sent.sentTo
          ? t('purchasing.send.doneSentTo', { address: sent.sentTo })
          : t('purchasing.send.doneNoMail'),
      )
      void queryClient.invalidateQueries({ queryKey: ['admin-purchasing'] })
    },
    onError: (error) => {
      const refused = refusalMessage(error, { order_mail_failed: t('purchasing.send.mailFailed') })
      if (refused) toast.error(refused)
      else
        handleMutationError(error, toast.error, {
          conflict: t('purchasing.send.alreadySent'),
          fallback: t('purchasing.send.alreadySent'),
        })
    },
  })

  const close = useMutation({
    mutationFn: (version: number) => closeSupplierOrder(id, version),
    onSuccess: () => {
      toast.success(t('purchasing.close.done'))
      void queryClient.invalidateQueries({ queryKey: ['admin-purchasing'] })
    },
    onError: (error) =>
      handleMutationError(error, toast.error, {
        conflict: t('purchasing.close.invalid'),
        fallback: t('purchasing.close.invalid'),
      }),
  })

  if (isLoading || !order) {
    return <Skeleton className="h-64 w-full" data-testid="supplier-order-detail-loading" />
  }

  return (
    <div className="space-y-6" data-testid="page-supplier-order-detail">
      <div>
        <Button
          variant="outline"
          size="sm"
          render={<Link to="/admin/purchasing" />}
          data-testid="supplier-order-back"
        >
          <ArrowLeft />
          {t('purchasing.backToList')}
        </Button>
      </div>

      <BackOfficePageHead
        title={order.supplier.name}
        description={t('purchasing.createdAtLabel', {
          date: new Date(order.createdAt).toLocaleString(),
        })}
        actions={
          <>
            <SupplierOrderStatusBadge
              status={order.status}
              testId="supplier-order-status"
              className="self-center"
            />
            <Button
              variant="outline"
              size="sm"
              data-testid="supplier-order-export"
              onClick={() => void downloadSupplierOrderExport(order.id)}
            >
              <Download />
              {t('purchasing.send.export')}
            </Button>
            {order.status === 'draft' && (
              <Button
                size="sm"
                data-testid="supplier-order-send"
                disabled={send.isPending}
                onClick={() => send.mutate(order.version)}
              >
                <Send />
                {t('purchasing.send.action')}
              </Button>
            )}
            {order.status === 'sent' && (
              <Button
                variant="outline"
                size="sm"
                data-testid="supplier-order-close"
                disabled={close.isPending}
                onClick={() => {
                  if (window.confirm(t('purchasing.close.confirm'))) close.mutate(order.version)
                }}
              >
                <XCircle />
                {t('purchasing.close.action')}
              </Button>
            )}
          </>
        }
      />

      {order.sentMode && (
        <p className="text-base text-muted-foreground" data-testid="supplier-order-sent-how">
          {t(`purchasing.sentHow.${order.sentMode}${order.sentTo ? 'To' : 'NoMail'}`, {
            address: order.sentTo ?? '',
          })}
        </p>
      )}

      {skippedLines.length > 0 && (
        <div
          className="flex gap-2 rounded-xl border-2 border-warning bg-straw-tint p-3 text-base text-foreground"
          data-testid="supplier-order-skipped"
        >
          <TriangleAlert className="mt-0.5 size-5 shrink-0" />
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

      <BackOfficeTableFrame>
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
                  <BackOfficeStatusBadge
                    tone={DISCREPANCY_TONE[line.discrepancy]}
                    data-testid="line-discrepancy"
                  >
                    {t(`purchasing.discrepancy.${line.discrepancy}`)}
                  </BackOfficeStatusBadge>
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
      </BackOfficeTableFrame>

      <div className="flex justify-end text-base" data-testid="supplier-order-total">
        <span className="text-muted-foreground">
          {t('purchasing.estimatedTotalLabel')}:{' '}
          <span className="font-semibold text-foreground">
            {t('purchasing.estimatedTotalValue', { value: order.estimatedTotalEur.toFixed(2) })}
          </span>
          {order.hasUnknownCostLines ? ` — ${t('purchasing.partialEstimate')}` : ''}
        </span>
      </div>

      {order.status === 'sent' && <ReceptionForm order={order} />}

      <section className="space-y-3" data-testid="supplier-order-receptions">
        <SectionTitle>{t('purchasing.receptionsHeading')}</SectionTitle>
        {order.receptions.length === 0 ? (
          <p
            className="text-base text-muted-foreground"
            data-testid="supplier-order-receptions-empty"
          >
            {t('purchasing.noReceptions')}
          </p>
        ) : (
          <ul className="space-y-4">
            {order.receptions.map((reception) => (
              <li
                key={reception.id}
                className="rounded-xl border-2 border-border bg-card p-3"
                data-testid={`reception-${reception.id}`}
              >
                <p className="mb-2 text-base font-medium">
                  {new Date(reception.receivedAt).toLocaleString()}
                </p>
                <ul className="space-y-1 text-base text-muted-foreground">
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
