import type { ShopProduct } from '@grocery/openapi-generator/client/types.gen'
import { Badge } from '@grocery/ui/components/primitives/badge'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@grocery/ui/components/primitives/card'
import { cn } from '@grocery/ui/lib/utils'
import { Package } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { ShopView } from '@/features/shop/hooks/use-shop-view'

export function ProductCard({
  product,
  view = 'large',
}: {
  product: ShopProduct
  view?: ShopView
}) {
  const { t } = useTranslation()
  const price = `${product.currentPriceEur.toFixed(2)} € / ${t(`catalog.pricingUnit.${product.pricingUnit}`)}`

  const image = product.photos[0] ? (
    <img src={product.photos[0]} alt={product.name} className="h-full w-full object-cover" />
  ) : (
    <Package className="size-8 text-muted-foreground" />
  )

  if (view === 'list') {
    return (
      <div
        data-testid={`shop-product-card-${product.id}`}
        className="flex items-center gap-3 rounded-xl bg-card p-2 text-card-foreground ring-1 ring-foreground/10"
      >
        <Link
          to={`/shop/products/${product.id}`}
          data-testid="shop-product-card-link"
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
            {image}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" data-testid="shop-product-card-name">
              {product.name}
            </p>
            <p className="text-sm text-muted-foreground">{price}</p>
          </div>
        </Link>
      </div>
    )
  }

  const compact = view === 'compact'

  return (
    <Card
      data-testid={`shop-product-card-${product.id}`}
      size={compact ? 'sm' : 'default'}
      className="h-full overflow-hidden"
    >
      <Link
        to={`/shop/products/${product.id}`}
        data-testid="shop-product-card-link"
        className="flex h-full flex-col gap-(--card-spacing)"
      >
        <div className="flex aspect-square shrink-0 items-center justify-center bg-muted">
          {image}
        </div>
        <CardHeader>
          <CardTitle
            className={cn('line-clamp-2', compact ? 'min-h-10' : 'min-h-11 text-base')}
            data-testid="shop-product-card-name"
          >
            {product.name}
          </CardTitle>
        </CardHeader>
        {!compact && product.labels.length > 0 && (
          <CardContent className="flex min-h-6 flex-wrap gap-1">
            {product.labels.map((label) => (
              <Badge key={label} variant="secondary">
                {t(`catalog.label.${label}`)}
              </Badge>
            ))}
          </CardContent>
        )}
        <CardFooter className={cn('mt-auto font-semibold', compact ? 'text-xs' : 'text-sm')}>
          {price}
        </CardFooter>
      </Link>
    </Card>
  )
}
