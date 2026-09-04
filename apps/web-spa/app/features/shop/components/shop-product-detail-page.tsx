import { Badge } from '@grocery/ui/components/primitives/badge'
import { Button } from '@grocery/ui/components/primitives/button'
import { Skeleton } from '@grocery/ui/components/primitives/skeleton'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Package } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { AddToCartForm } from '@/features/cart/components/add-to-cart-form'
import { shopProductDetailQueryOptions } from '@/features/shop/utils/shop-queries'

export default function ShopProductDetailPage() {
  const { t } = useTranslation()
  const { productId = '' } = useParams()

  const { data: product, isLoading } = useQuery(shopProductDetailQueryOptions(productId))

  if (isLoading || !product) return <Skeleton className="h-96 w-full" />

  const unit = t(`catalog.pricingUnit.${product.pricingUnit}`)

  return (
    <div className="space-y-6" data-testid="page-shop-product-detail">
      <Button variant="ghost" size="sm" render={<Link to="/shop" />}>
        <ArrowLeft className="mr-2 size-4" />
        {t('shop.backToShop')}
      </Button>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex aspect-square items-center justify-center rounded-lg bg-muted">
          {product.photos[0] ? (
            <img
              src={product.photos[0]}
              alt={product.name}
              className="h-full w-full rounded-lg object-cover"
            />
          ) : (
            <Package className="size-16 text-muted-foreground" />
          )}
        </div>

        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight" data-testid="shop-product-name">
              {product.name}
            </h1>
            <p className="text-sm text-muted-foreground">{product.category.name}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              <Badge variant="outline" data-testid="shop-product-ordering-mode">
                {t(`catalog.orderingMode.${product.orderingMode}`)}
              </Badge>
              {product.labels.map((label) => (
                <Badge key={label} variant="secondary">
                  {t(`catalog.label.${label}`)}
                </Badge>
              ))}
            </div>
          </div>

          <p className="text-xl font-bold" data-testid="shop-product-price">
            {product.currentPriceEur.toFixed(2)} € / {unit}
          </p>

          {product.description && (
            <p className="text-sm text-muted-foreground" data-testid="shop-product-description">
              {product.description}
            </p>
          )}

          <AddToCartForm product={product} />
        </div>
      </div>
    </div>
  )
}
