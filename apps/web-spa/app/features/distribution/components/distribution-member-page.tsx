import type { WalletEntry } from '@grocery/openapi-generator/client/types.gen'
import { PageTitle, SectionTitle } from '@grocery/ui/components/app'
import { Badge } from '@grocery/ui/components/primitives/badge'
import { Button } from '@grocery/ui/components/primitives/button'
import { Skeleton } from '@grocery/ui/components/primitives/skeleton'
import { useQuery } from '@tanstack/react-query'
import { Banknote, ShoppingBasket, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { DistributionNotice } from '@/features/distribution/components/distribution-notice'
import { HandoverForm } from '@/features/distribution/components/handover-form'
import { InsufficientBalanceDialog } from '@/features/distribution/components/insufficient-balance-dialog'
import { distributionMemberScreenQueryOptions } from '@/features/distribution/utils/distribution-queries'
import { useRoles } from '@/features/common/hooks/use-session'
import { CorrectPaymentDialog } from '@/features/wallet/components/correct-payment-dialog'
import { RefundDialog } from '@/features/wallet/components/refund-dialog'
import { WalletPanel } from '@/features/wallet/components/wallet-panel'
import { staffWalletQueryOptions } from '@/features/wallet/utils/wallet-queries'

/**
 * One member's table screen, top to bottom: name and number, the balance, every order still
 * waiting (each line showing what was ordered against what is on the shelf, with its handover
 * form), any warning, then the big actions.
 */
export default function DistributionMemberPage() {
  const { t } = useTranslation()
  const { memberId = '' } = useParams()
  const { data, isLoading } = useQuery(distributionMemberScreenQueryOptions(memberId))
  const [recordedHandoverId, setRecordedHandoverId] = useState<string | null>(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [shortfallEur, setShortfallEur] = useState<number | undefined>(undefined)
  const [correcting, setCorrecting] = useState<WalletEntry | null>(null)
  const [refundOpen, setRefundOpen] = useState(false)
  const { isAdmin } = useRoles()
  const { data: wallet } = useQuery(staffWalletQueryOptions(memberId))

  if (isLoading || !data) {
    return <Skeleton className="h-64 w-full" data-testid="page-distribution-member-loading" />
  }

  const eur = (value: number) => t('distribution.eur', { value: value.toFixed(2) })

  return (
    <div className="space-y-8" data-testid="page-distribution-member">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-base text-muted-foreground">{data.membershipNumber}</p>
          <PageTitle className="text-5xl">{data.name}</PageTitle>
        </div>
        <div
          className="rounded-xl border-4 border-border bg-slate px-6 py-4 text-slate-foreground"
          data-testid="distribution-member-balance-block"
        >
          <p className="text-base">{t('distribution.member.balance')}</p>
          <p
            className="font-serif text-3xl font-bold italic tabular-nums"
            data-testid="distribution-member-balance"
          >
            {eur(data.balanceEur)}
          </p>
        </div>
      </div>

      {recordedHandoverId ? (
        <DistributionNotice tone="success" data-testid="handover-receipt">
          <div className="flex flex-wrap items-center gap-2">
            <span>{t('distribution.handover.receipt')}</span>
            <Button
              variant="link"
              className="ml-auto"
              data-testid="handover-receipt-link"
              render={<Link to={`/distribution/handovers/${recordedHandoverId}`} />}
            >
              {t('distribution.waiting.open')}
            </Button>
          </div>
        </DistributionNotice>
      ) : null}

      <section className="space-y-4" data-testid="distribution-to-hand-over">
        <div className="flex flex-wrap items-center gap-3">
          <SectionTitle className="text-2xl">{t('distribution.member.toHandOver')}</SectionTitle>
          {data.orders.length > 0 ? (
            <span className="rounded-full bg-straw px-3 text-sm font-semibold text-straw-foreground">
              {t('distribution.search.outstanding', { count: data.orders.length })}
            </span>
          ) : null}
        </div>

        {data.orders.length === 0 ? (
          <p
            className="text-base text-muted-foreground"
            data-testid="distribution-nothing-to-collect"
          >
            {t('distribution.member.nothingToCollect')}
          </p>
        ) : null}

        {data.orders.map((order) => (
          <section
            key={order.id}
            data-testid={`distribution-order-${order.id}`}
            className="overflow-hidden rounded-xl border-2 border-border bg-card"
          >
            <header className="flex flex-wrap items-center gap-3 border-b border-rule p-4">
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
              <span className="ml-auto text-lg font-semibold tabular-nums">
                {eur(order.totalEur)}
              </span>
            </header>

            <HandoverForm
              order={order}
              onRecorded={(handoverId) => {
                setRecordedHandoverId(handoverId)
                setPaymentOpen(false)
                setShortfallEur(undefined)
              }}
              onInsufficientBalance={(shortfall) => {
                setShortfallEur(shortfall)
                setPaymentOpen(true)
              }}
            />
          </section>
        ))}
      </section>

      {data.balanceEur < 0 ? (
        <DistributionNotice tone="warning" data-testid="distribution-member-negative-notice">
          {t('wallet.negative.staff')}
        </DistributionNotice>
      ) : null}

      {data.status !== 'active' ? (
        <DistributionNotice tone="warning" data-testid="distribution-member-status-warning">
          {t('distribution.member.statusWarning', { status: data.status })}
          {data.status === 'terminated' ? ` ${t('distribution.member.terminatedBlocked')}` : ''}
        </DistributionNotice>
      ) : null}

      <div className="flex flex-wrap gap-3" data-testid="distribution-actions">
        <Button
          className="h-18 px-6 text-lg bg-warning text-warning-foreground hover:bg-warning/90"
          data-testid="wallet-record-payment"
          onClick={() => setPaymentOpen(true)}
        >
          <Banknote />
          {t('wallet.recordPayment')}
        </Button>
        <Button
          variant="outline"
          className="h-18 px-6 text-lg"
          data-testid="distribution-start-express"
          render={<Link to={`/distribution/members/${memberId}/express`} />}
        >
          <ShoppingBasket />
          {t('distribution.member.startExpress')}
        </Button>
        {isAdmin ? (
          <Button
            variant="outline"
            className="h-18 px-6 text-lg"
            data-testid="wallet-refund-open"
            disabled={data.balanceEur <= 0}
            title={data.balanceEur <= 0 ? t('wallet.refund.disabledNoBalance') : undefined}
            onClick={() => setRefundOpen(true)}
          >
            <Undo2 />
            {t('wallet.refund.open')}
          </Button>
        ) : null}
      </div>

      {paymentOpen ? (
        <InsufficientBalanceDialog
          memberId={memberId}
          shortfallEur={shortfallEur}
          onPaid={() => {
            setPaymentOpen(false)
            setShortfallEur(undefined)
          }}
          onDismiss={() => {
            setPaymentOpen(false)
            setShortfallEur(undefined)
          }}
        />
      ) : null}

      <WalletPanel wallet={wallet} onCorrect={setCorrecting} />

      {refundOpen ? (
        <RefundDialog
          memberId={memberId}
          balanceEur={data.balanceEur}
          onClose={() => setRefundOpen(false)}
        />
      ) : null}

      {correcting ? (
        <CorrectPaymentDialog
          memberId={memberId}
          entry={correcting}
          onClose={() => setCorrecting(null)}
        />
      ) : null}
    </div>
  )
}
