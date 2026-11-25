import { PageTitle } from '@grocery/ui/components/app'
import { Button } from '@grocery/ui/components/primitives/button'
import { Input } from '@grocery/ui/components/primitives/input'
import type { DistributionProduct } from '@grocery/openapi-generator/client/types.gen'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { DistributionNotice } from '@/features/distribution/components/distribution-notice'
import {
  createExpressOrder,
  distributionMemberScreenQueryOptions,
  sellableProductsQueryOptions,
} from '@/features/distribution/utils/distribution-queries'
import { useDebouncedSearch } from '@/hooks/use-debounced-search'

interface DraftLine {
  product: DistributionProduct
  quantity: string
}

interface RefusalBody {
  code?: string
  shortfallEur?: number
  productName?: string
}

/**
 * An express sale, built at the table. The draft lives here and nowhere else — nothing is
 * persisted until the member pays (FR-016), so abandoning the screen leaves no order, no
 * stock movement and no charge behind.
 */
export default function ExpressOrderForm() {
  const { t } = useTranslation()
  const { memberId = '' } = useParams()
  const queryClient = useQueryClient()
  const [committed, setCommitted] = useState('')
  const { search, setSearch } = useDebouncedSearch('', (value) => setCommitted(value ?? ''))
  const [lines, setLines] = useState<DraftLine[]>([])
  const [refusal, setRefusal] = useState<RefusalBody | null>(null)
  const [recordedHandoverId, setRecordedHandoverId] = useState<string | null>(null)

  const { data: member } = useQuery(distributionMemberScreenQueryOptions(memberId))
  const { data: products } = useQuery(sellableProductsQueryOptions(committed))

  const eur = (value: number) => t('distribution.eur', { value: value.toFixed(2) })
  const quantityOf = (line: DraftLine) => Number(line.quantity) || 0
  const totalEur = lines.reduce(
    (sum, line) => sum + quantityOf(line) * line.product.unitPriceEur,
    0,
  )

  const addProduct = (product: DistributionProduct) => {
    setSearch('')
    setCommitted('')
    setLines((current) =>
      current.some((line) => line.product.id === product.id)
        ? current
        : [...current, { product, quantity: '1' }],
    )
  }

  const mutation = useMutation({
    mutationFn: async () =>
      createExpressOrder(memberId, {
        lines: lines.map((line) => ({
          productId: line.product.id,
          quantity: quantityOf(line),
        })),
      }),
    onSuccess: (handover) => {
      setRefusal(null)
      setLines([])
      setRecordedHandoverId(handover.id)
      toast.success(t('distribution.express.success', { amount: eur(handover.totalEur) }))
      void queryClient.invalidateQueries({ queryKey: ['distribution'] })
      // The sale just charged the member, so any wallet view of them is now behind.
      void queryClient.invalidateQueries({ queryKey: ['wallet'] })
    },
    onError: (error: unknown) => setRefusal((error as RefusalBody | undefined) ?? {}),
  })

  return (
    <div className="space-y-6" data-testid="page-express-order">
      <div>
        <PageTitle>{t('distribution.express.title')}</PageTitle>
        {member ? (
          <p className="text-base text-muted-foreground">
            {member.name} — {t('distribution.member.balance')} {eur(member.balanceEur)}
          </p>
        ) : null}
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

      <div className="space-y-2">
        <Input
          className="h-16 max-w-xl text-xl"
          data-testid="express-product-search"
          placeholder={t('distribution.express.searchPlaceholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {products && products.data.length > 0 ? (
          <ul className="max-w-xl space-y-2">
            {products.data.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  data-testid={`express-product-option-${product.id}`}
                  onClick={() => addProduct(product)}
                  className="flex min-h-14 w-full items-center gap-3 rounded-xl border-2 border-border bg-card px-4 text-left text-lg hover:bg-accent"
                >
                  <span className="flex-1">{product.name}</span>
                  <span className="tabular-nums">{eur(product.unitPriceEur)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {lines.length === 0 ? (
        <p className="text-base text-muted-foreground">{t('distribution.express.empty')}</p>
      ) : (
        <ul className="divide-y divide-rule rounded-xl border-2 border-border bg-card">
          {lines.map((line) => {
            const overStock = quantityOf(line) > line.product.quantityOnHand
            return (
              <li
                key={line.product.id}
                data-testid={`express-line-${line.product.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
              >
                <span className="min-w-40 flex-1 text-lg font-semibold">{line.product.name}</span>
                <Input
                  className="h-12 w-28 text-lg tabular-nums"
                  data-testid="express-qty"
                  type="number"
                  min={0}
                  step={line.product.saleMode === 'weight' ? 0.001 : 1}
                  value={line.quantity}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((entry) =>
                        entry.product.id === line.product.id
                          ? { ...entry, quantity: event.target.value }
                          : entry,
                      ),
                    )
                  }
                />
                <span className="text-lg tabular-nums">
                  {eur(quantityOf(line) * line.product.unitPriceEur)}
                </span>
                {overStock ? (
                  <span
                    className="flex items-center gap-1 rounded-full bg-warning px-3 py-1 text-sm font-semibold text-warning-foreground"
                    data-testid="express-over-stock"
                  >
                    <AlertTriangle className="size-5" />
                    {t('distribution.express.overStock', {
                      available: line.product.quantityOnHand,
                    })}
                  </span>
                ) : null}
                <Button
                  variant="ghost"
                  data-testid="express-remove"
                  onClick={() =>
                    setLines((current) =>
                      current.filter((entry) => entry.product.id !== line.product.id),
                    )
                  }
                >
                  <Trash2 />
                  {t('distribution.express.remove')}
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-4 rounded-xl border-2 border-rule bg-kraft/40 p-4 dark:bg-muted">
        <span className="text-base">{t('distribution.order.total')}</span>
        <span
          className="font-serif text-3xl font-bold italic tabular-nums"
          data-testid="express-total"
        >
          {eur(totalEur)}
        </span>
        <Button
          className="ml-auto h-18 min-w-64 px-8 text-lg"
          data-testid="express-submit"
          disabled={lines.length === 0 || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {t('distribution.express.validate')}
        </Button>
      </div>

      {refusal ? (
        <DistributionNotice tone="warning" data-testid="express-refusal">
          {t(`distribution.refusal.${refusal.code ?? 'order_not_pending'}`, {
            amount: refusal.shortfallEur == null ? '' : eur(refusal.shortfallEur),
            productName: refusal.productName ?? '',
          })}
        </DistributionNotice>
      ) : null}
    </div>
  )
}
