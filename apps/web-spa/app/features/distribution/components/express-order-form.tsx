import { PageTitle } from '@grocery/ui/components/app'
import { Button } from '@grocery/ui/components/primitives/button'
import { Input } from '@grocery/ui/components/primitives/input'
import type { DistributionProduct } from '@grocery/openapi-generator/client/types.gen'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
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
    },
    onError: (error: unknown) => setRefusal((error as RefusalBody | undefined) ?? {}),
  })

  return (
    <div className="space-y-6" data-testid="page-express-order">
      <div>
        <PageTitle>{t('distribution.express.title')}</PageTitle>
        {member ? (
          <p className="text-sm text-muted-foreground">
            {member.name} — {t('distribution.member.balance')} {eur(member.balanceEur)}
          </p>
        ) : null}
      </div>

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

      <div className="space-y-2">
        <Input
          className="max-w-md text-base"
          data-testid="express-product-search"
          placeholder={t('distribution.express.searchPlaceholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {products && products.data.length > 0 ? (
          <ul className="max-w-md space-y-1">
            {products.data.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  data-testid={`express-product-option-${product.id}`}
                  onClick={() => addProduct(product)}
                  className="flex w-full items-center gap-3 rounded-md border border-border p-2 text-left hover:bg-accent"
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
        <p className="text-sm text-muted-foreground">{t('distribution.express.empty')}</p>
      ) : (
        <ul className="space-y-3">
          {lines.map((line) => {
            const overStock = quantityOf(line) > line.product.quantityOnHand
            return (
              <li
                key={line.product.id}
                data-testid={`express-line-${line.product.id}`}
                className="flex flex-wrap items-center gap-3"
              >
                <span className="min-w-40 flex-1 font-medium">{line.product.name}</span>
                <Input
                  className="w-28 text-base tabular-nums"
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
                <span className="tabular-nums">
                  {eur(quantityOf(line) * line.product.unitPriceEur)}
                </span>
                {overStock ? (
                  <span
                    className="flex items-center gap-1 text-sm text-amber-600"
                    data-testid="express-over-stock"
                  >
                    <AlertTriangle className="size-4" />
                    {t('distribution.express.overStock', {
                      available: line.product.quantityOnHand,
                    })}
                  </span>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid="express-remove"
                  onClick={() =>
                    setLines((current) =>
                      current.filter((entry) => entry.product.id !== line.product.id),
                    )
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-4 border-t border-border pt-4">
        <span className="text-sm text-muted-foreground">{t('distribution.order.total')}</span>
        <span className="text-xl font-semibold tabular-nums" data-testid="express-total">
          {eur(totalEur)}
        </span>
        <Button
          className="ml-auto"
          data-testid="express-submit"
          disabled={lines.length === 0 || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {t('distribution.express.validate')}
        </Button>
      </div>

      {refusal ? (
        <p className="text-sm text-destructive" data-testid="express-refusal">
          {t(`distribution.refusal.${refusal.code ?? 'order_not_pending'}`, {
            amount: refusal.shortfallEur == null ? '' : eur(refusal.shortfallEur),
            productName: refusal.productName ?? '',
          })}
        </p>
      ) : null}
    </div>
  )
}
