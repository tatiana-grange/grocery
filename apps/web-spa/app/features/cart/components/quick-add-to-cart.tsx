import type { OrderingModeChoice, ShopProduct } from '@grocery/openapi-generator/client/types.gen'
import { Button } from '@grocery/ui/components/primitives/button'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { AddToCartControl } from '@/features/cart/components/add-to-cart-control'
import { useCartLine } from '@/features/cart/hooks/use-cart-line'
import { useCartLineActions } from '@/features/cart/hooks/use-cart-line-actions'

/**
 * The add-to-cart control on a shop product card. Everything it does is `AddToCartControl`'s
 * job; the one thing that only makes sense here is the product that offers both ordering
 * modes and isn't in the cart yet — the mode has to be picked before it can be added, so the
 * card links to the product page instead. Once a line exists its mode is settled and the
 * stepper just adjusts the quantity.
 */
export function QuickAddToCart({ product }: { product: ShopProduct }) {
  const { t } = useTranslation()
  const line = useCartLine(product.id)
  const actions = useCartLineActions({
    productId: product.id,
    orderingMode: line?.orderingMode ?? (product.orderingMode as OrderingModeChoice),
    lineId: line?.id,
  })

  if (!line && product.orderingMode === 'both') {
    return (
      <Button
        size="sm"
        variant="outline"
        className="w-full"
        render={<Link to={`/shop/products/${product.id}`} />}
      >
        {t('shop.quickAdd.chooseOptions')}
      </Button>
    )
  }

  return (
    <AddToCartControl
      product={product}
      line={line}
      actions={actions}
      size="sm"
      testIds={{
        root: `quick-add-stepper-${product.id}`,
        signIn: `quick-add-signin-${product.id}`,
        add: `quick-add-submit-${product.id}`,
        decrease: `quick-add-decrease-${product.id}`,
        increase: `quick-add-increase-${product.id}`,
        amount: `quick-add-quantity-${product.id}`,
      }}
    />
  )
}
