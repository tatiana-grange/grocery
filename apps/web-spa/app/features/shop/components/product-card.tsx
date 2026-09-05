import { Badge } from '@grocery/ui/components/primitives/badge'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@grocery/ui/components/primitives/card'
import { Package } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { ShopProduct } from '@grocery/openapi-generator/client/types.gen'

export function ProductCard({ product }: { product: ShopProduct }) {
  const { t } = useTranslation()

  return (
    <Card data-testid={`shop-product-card-${product.id}`} className="overflow-hidden">
      <Link to={`/shop/products/${product.id}`} data-testid="shop-product-card-link">
        <div className="flex aspect-square items-center justify-center bg-muted">
          {product.photos[0] ? (
            <img
              src={product.photos[0]}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <Package className="size-10 text-muted-foreground" />
          )}
        </div>
        <CardHeader>
          <CardTitle className="text-base" data-testid="shop-product-card-name">
            {product.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1">
          <Badge variant="outline">{t(`catalog.orderingMode.${product.orderingMode}`)}</Badge>
          {product.labels.map((label) => (
            <Badge key={label} variant="secondary">
              {t(`catalog.label.${label}`)}
            </Badge>
          ))}
        </CardContent>
        <CardFooter className="text-sm font-semibold">
          {product.currentPriceEur.toFixed(2)} € / {t(`catalog.pricingUnit.${product.pricingUnit}`)}
        </CardFooter>
      </Link>
    </Card>
  )
}
