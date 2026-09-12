import { PageTitle } from '@grocery/ui/components/app'
import { Badge } from '@grocery/ui/components/primitives/badge'
import { Button } from '@grocery/ui/components/primitives/button'
import { Skeleton } from '@grocery/ui/components/primitives/skeleton'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { HandoverForm } from '@/features/distribution/components/handover-form'
import { distributionMemberScreenQueryOptions } from '@/features/distribution/utils/distribution-queries'

/**
 * One member's table screen: status, balance, and every order still waiting, each line
 * showing what was ordered against what is actually on the shelf. US2 adds the handover
 * form on top of this.
 */
export default function DistributionMemberPage() {
  const { t } = useTranslation()
  const { memberId = '' } = useParams()
  const { data, isLoading } = useQuery(distributionMemberScreenQueryOptions(memberId))
  const [recordedHandoverId, setRecordedHandoverId] = useState<string | null>(null)

  if (isLoading || !data) {
    return <Skeleton className="h-64 w-full" data-testid="page-distribution-member-loading" />
  }

  const eur = (value: number) => t('distribution.eur', { value: value.toFixed(2) })

  return (
    <div className="space-y-6" data-testid="page-distribution-member">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex-1">
          <PageTitle>{data.name}</PageTitle>
          <p className="text-sm text-muted-foreground">{data.membershipNumber}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">{t('distribution.member.balance')}</p>
          <p
            className="text-2xl font-semibold tabular-nums"
            data-testid="distribution-member-balance"
          >
            {eur(data.balanceEur)}
          </p>
        </div>
      </div>

      {data.status !== 'active' ? (
        <div
          className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm"
          data-testid="distribution-member-status-warning"
        >
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            {t('distribution.member.statusWarning', { status: data.status })}
            {data.status === 'terminated' ? ` ${t('distribution.member.terminatedBlocked')}` : ''}
          </span>
        </div>
      ) : null}

      {recordedHandoverId ? (
        <div
          className="flex items-center gap-2 rounded-lg border border-border bg-accent/40 p-3 text-sm"
          data-testid="handover-receipt"
        >
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{t('distribution.handover.receipt')}</span>
          <Link
            className="ml-auto underline"
            to={`/distribution/handovers/${recordedHandoverId}`}
            data-testid="handover-receipt-link"
          >
            {t('distribution.waiting.open')}
          </Link>
        </div>
      ) : null}

      {data.orders.length === 0 ? (
        <p className="text-muted-foreground" data-testid="distribution-nothing-to-collect">
          {t('distribution.member.nothingToCollect')}
        </p>
      ) : null}

      {data.orders.map((order) => (
        <section
          key={order.id}
          data-testid={`distribution-order-${order.id}`}
          className="rounded-lg border border-border"
        >
          <header className="flex flex-wrap items-center gap-3 border-b border-border p-4">
            <Badge variant="secondary">
              {order.orderingMode === 'pre_order'
                ? t('distribution.order.preOrder')
                : t('distribution.order.inStore')}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {t('distribution.order.placedAt', {
                date: new Date(order.placedAt).toLocaleDateString(),
              })}
            </span>
            <Badge
              variant={order.isReady ? 'default' : 'outline'}
              data-testid={order.isReady ? 'order-readiness-ready' : 'order-readiness-not-ready'}
            >
              {order.isReady ? t('distribution.order.ready') : t('distribution.order.notReady')}
            </Badge>
            <span className="ml-auto font-medium tabular-nums">{eur(order.totalEur)}</span>
          </header>

          <ul className="divide-y divide-border">
            {order.lines.map((line) => (
              <li key={line.orderLineId} className="flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-48 flex-1">
                  <p className="font-medium">{line.productName}</p>
                  {line.isReady ? null : (
                    <p
                      className="text-sm text-destructive"
                      data-testid="distribution-line-not-ready"
                    >
                      {t(`distribution.notReadyReason.${line.notReadyReason}`)}
                    </p>
                  )}
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">{t('distribution.line.ordered')} </span>
                  <span className="tabular-nums">{line.orderedQuantity}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">{t('distribution.line.available')} </span>
                  <span
                    className={`tabular-nums ${line.availableQuantity < 0 ? 'text-destructive' : ''}`}
                    data-testid="distribution-line-available"
                  >
                    {line.availableQuantity}
                  </span>
                </div>
                <span className="tabular-nums">{eur(line.lineTotalEur)}</span>
              </li>
            ))}
          </ul>

          <HandoverForm
            order={order}
            onRecorded={(handoverId) => setRecordedHandoverId(handoverId)}
          />
        </section>
      ))}

      <div className="flex gap-2">
        <Button
          variant="secondary"
          data-testid="distribution-start-express"
          render={<Link to={`/distribution/members/${memberId}/express`} />}
        >
          {t('distribution.member.startExpress')}
        </Button>
      </div>
    </div>
  )
}
