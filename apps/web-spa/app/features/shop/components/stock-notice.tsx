import type { ShopProduct } from '@grocery/openapi-generator/client/types.gen'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@grocery/ui/components/primitives/tooltip'
import { cn } from '@grocery/ui/lib/utils'
import { Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCartProductQuantity } from '@/features/cart/hooks/use-cart-line'
import { formatQuantity, selectionUnitLabel } from '@/features/cart/utils/cart-quantity'

/**
 * "3 en stock" beside a shop product's add-to-cart control, shown only once a reception has
 * actually put something on the shelf — a product that has never been received says nothing,
 * because there is nothing to promise and the shopper is pre-ordering it anyway.
 *
 * Asking for more than that is allowed on purpose: the shopper gets what is there at pickup
 * and the rest on the supplier's next delivery. So the line turns red and grows an icon
 * explaining that, rather than the stepper refusing to go further.
 */
export function StockNotice({ product, className }: { product: ShopProduct; className?: string }) {
  const { t } = useTranslation()
  const inCart = useCartProductQuantity(product.id)

  // `?? 0` only bites against an API too old to send the field.
  const onHand = product.quantityOnHand ?? 0
  if (onHand <= 0) return null

  // Weight products name their unit ("500 g"), a piece count speaks for itself ("3 en stock").
  const amount =
    product.saleMode === 'weight'
      ? `${formatQuantity(product, onHand)} ${t(`catalog.pricingUnit.${selectionUnitLabel(product)}`)}`
      : formatQuantity(product, onHand)
  const label = t('shop.stock.onHand', { amount })
  const testId = `shop-stock-${product.id}`

  if (inCart <= onHand) {
    return (
      <p className={cn('text-xs text-muted-foreground', className)} data-testid={testId}>
        {label}
      </p>
    )
  }

  // The delay lives on the provider, not the tooltip, and no provider wraps the app — so the
  // notice brings its own rather than every card opening its tooltip the instant a cursor
  // crosses it on the way somewhere else.
  return (
    <TooltipProvider delay={150}>
      <Tooltip>
        <TooltipTrigger
          aria-label={t('shop.stock.overLabel')}
          data-testid={testId}
          data-over="true"
          className={cn('flex items-center gap-1 text-xs font-medium text-destructive', className)}
        >
          {label}
          <Info className="size-3.5 shrink-0" />
        </TooltipTrigger>
        <TooltipContent>{t('shop.stock.overTooltip', { amount })}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
