import { SectionTitle } from '@grocery/ui/components/app'
import { Badge } from '@grocery/ui/components/primitives/badge'
import { Button } from '@grocery/ui/components/primitives/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@grocery/ui/components/primitives/dialog'
import { Input } from '@grocery/ui/components/primitives/input'
import { Skeleton } from '@grocery/ui/components/primitives/skeleton'
import { toast } from '@grocery/ui/components/primitives/sonner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import {
  archiveProduct,
  productDetailQueryOptions,
  setProductPrice,
  unarchiveProduct,
} from '@/features/catalog/utils/catalog-queries'
import { BackOfficePageHead } from '@/features/common/components/back-office-page-head'
import { BackOfficeStatusBadge } from '@/features/common/components/back-office-status-badge'

export default function ProductDetailPage() {
  const { t } = useTranslation()
  const { productId = '' } = useParams()
  const queryClient = useQueryClient()
  const [newPrice, setNewPrice] = useState('')

  const { data: product, isLoading } = useQuery(productDetailQueryOptions(productId))
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['catalog'] })

  const priceMutation = useMutation({
    mutationFn: () => setProductPrice(productId, { amountEur: Number(newPrice) }),
    onSuccess: () => {
      toast.success(t('catalog.toasts.priceUpdated'))
      setNewPrice('')
      invalidate()
    },
    onError: () => toast.error(t('catalog.toasts.error')),
  })

  const archiveMutation = useMutation({
    mutationFn: (archived: boolean) =>
      archived ? unarchiveProduct(productId) : archiveProduct(productId),
    onSuccess: (_data, archived) => {
      toast.success(archived ? t('catalog.toasts.restored') : t('catalog.toasts.archived'))
      invalidate()
    },
    onError: () => toast.error(t('catalog.toasts.error')),
  })

  if (isLoading || !product) return <Skeleton className="h-64 w-full" />

  const unit = t(`catalog.pricingUnit.${product.pricingUnit}`)

  return (
    <div className="space-y-6" data-testid="page-product-detail">
      <div>
        <Button variant="outline" size="sm" render={<Link to="/admin/catalog" />}>
          <ArrowLeft />
          {t('catalog.backToCatalogue')}
        </Button>
      </div>

      <BackOfficePageHead
        title={product.name}
        titleTestId="product-detail-name"
        description={`${product.supplier.name} · ${product.category.name}`}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              data-testid="product-detail-archive-toggle"
              onClick={() => archiveMutation.mutate(Boolean(product.archivedAt))}
            >
              {product.archivedAt ? t('catalog.unarchive') : t('catalog.archive')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              data-testid="product-detail-edit"
              render={<Link to={`/admin/catalog/products/${productId}/edit`} />}
            >
              {t('catalog.edit')}
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{t(`catalog.saleMode.${product.saleMode}`)}</Badge>
        {product.labels.map((label) => (
          <Badge key={label} variant="secondary">
            {t(`catalog.label.${label}`)}
          </Badge>
        ))}
        {product.archivedAt && (
          <BackOfficeStatusBadge tone="neutral" data-testid="product-archived-badge">
            {t('catalog.archived')}
          </BackOfficeStatusBadge>
        )}
      </div>

      <div className="rounded-xl border-2 border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-muted-foreground">
              {t('catalog.products.currentPrice')}
            </p>
            <p className="text-xl font-bold" data-testid="product-current-price">
              {product.currentPriceEur != null
                ? `${product.currentPriceEur.toFixed(2)} € / ${unit}`
                : '—'}
            </p>
          </div>
          <Dialog>
            <DialogTrigger render={<Button size="sm" data-testid="product-price-open" />}>
              {t('catalog.products.changePrice')}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('catalog.products.changePrice')}</DialogTitle>
              </DialogHeader>
              <Input
                type="number"
                step="0.01"
                data-testid="product-price-amount"
                placeholder={`€ / ${unit}`}
                value={newPrice}
                onChange={(event) => setNewPrice(event.target.value)}
              />
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  {t('common.cancel')}
                </DialogClose>
                <DialogClose
                  render={<Button data-testid="product-price-confirm" />}
                  disabled={!(Number(newPrice) > 0) || priceMutation.isPending}
                  onClick={() => priceMutation.mutate()}
                >
                  {t('catalog.save')}
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <section className="space-y-2">
        <SectionTitle>{t('catalog.products.priceHistory')}</SectionTitle>
        <ul className="space-y-1 text-base" data-testid="product-price-history">
          {[...product.priceHistory].reverse().map((window) => (
            <li
              key={window.id}
              data-testid="product-price-history-item"
              className="flex justify-between border-b border-rule py-1"
            >
              <span className="font-medium">
                {window.amountEur.toFixed(2)} € / {unit}
                {!window.validTo && (
                  <Badge variant="outline" className="ml-2" data-testid="product-price-current">
                    {t('catalog.products.current')}
                  </Badge>
                )}
              </span>
              <span className="text-muted-foreground">
                {new Date(window.validFrom).toLocaleDateString()}
                {window.validTo ? ` → ${new Date(window.validTo).toLocaleDateString()}` : ''}
                {window.setByName ? ` · ${window.setByName}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
