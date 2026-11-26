import { PageTitle } from '@grocery/ui/components/app'
import { Badge } from '@grocery/ui/components/primitives/badge'
import { Button } from '@grocery/ui/components/primitives/button'
import { Input } from '@grocery/ui/components/primitives/input'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { waitingOrdersQueryOptions } from '@/features/distribution/utils/distribution-queries'

/**
 * The table's landing screen: the waiting lists (US5). The member search, which is how a
 * distribution actually starts, lives in the layout beside every page.
 */
export default function DistributionHomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'pre_order' | 'in_store'>('pre_order')
  const [placedFrom, setPlacedFrom] = useState('')
  const [placedTo, setPlacedTo] = useState('')
  const { data: waiting } = useQuery(
    waitingOrdersQueryOptions({
      orderingMode: tab,
      placedFrom: placedFrom || undefined,
      placedTo: placedTo || undefined,
    }),
  )
  const waitingRows = waiting?.data ?? []

  return (
    <div className="space-y-6" data-testid="page-distribution-home">
      <div>
        <PageTitle>{t('distribution.table.ordersToHandOver')}</PageTitle>
        <p className="text-base text-muted-foreground">{t('distribution.subtitle')}</p>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {(['pre_order', 'in_store'] as const).map((candidate) => (
            <Button
              key={candidate}
              variant={tab === candidate ? 'default' : 'outline'}
              data-testid={`waiting-tab-${candidate}`}
              onClick={() => setTab(candidate)}
            >
              {candidate === 'pre_order'
                ? t('distribution.waiting.preOrders')
                : t('distribution.waiting.inStoreOrders')}
            </Button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-base">
            <span className="text-muted-foreground">{t('distribution.waiting.from')}</span>
            <Input
              className="w-44"
              data-testid="waiting-placed-from"
              type="date"
              value={placedFrom}
              onChange={(event) => setPlacedFrom(event.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-base">
            <span className="text-muted-foreground">{t('distribution.waiting.to')}</span>
            <Input
              className="w-44"
              data-testid="waiting-placed-to"
              type="date"
              value={placedTo}
              onChange={(event) => setPlacedTo(event.target.value)}
            />
          </label>
        </div>

        <div data-testid="waiting-list" className="space-y-2">
          {waitingRows.length === 0 ? (
            <p className="text-base text-muted-foreground" data-testid="waiting-empty">
              {t('distribution.waiting.empty')}
            </p>
          ) : (
            waitingRows.map((row) => (
              <button
                key={row.orderId}
                type="button"
                data-testid={`waiting-row-${row.orderId}`}
                onClick={() => navigate(`/distribution/members/${row.member.id}`)}
                className="flex min-h-19 w-full items-center gap-4 rounded-xl border-2 border-border bg-card p-4 text-left hover:bg-accent"
              >
                <div className="flex-1">
                  <p className="text-lg font-bold">{row.member.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('distribution.order.placedAt', {
                      date: new Date(row.placedAt).toLocaleDateString(),
                    })}
                  </p>
                </div>
                <Badge variant={row.isReady ? 'default' : 'outline'}>
                  {row.isReady ? t('distribution.order.ready') : t('distribution.order.notReady')}
                </Badge>
                <span className="font-serif text-lg italic tabular-nums">
                  {t('distribution.eur', { value: row.totalEur.toFixed(2) })}
                </span>
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
