import {
  OrderingModeChoice,
  type ShopProductDetail,
} from '@grocery/openapi-generator/client/types.gen'
import { SegmentedControl } from '@grocery/ui/components/primitives/segmented-control'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AddToCartControl } from '@/features/cart/components/add-to-cart-control'
import { useCartLine } from '@/features/cart/hooks/use-cart-line'
import { useCartLineActions } from '@/features/cart/hooks/use-cart-line-actions'

// Derived from the generated client's enum instead of a hand-copied literal tuple, so a new
// ordering mode added server-side shows up here without a forgotten manual update.
const ORDERING_MODE_CHOICES = Object.values(OrderingModeChoice)

/**
 * The add-to-cart control on the product page, with an ordering-mode picker above it when the
 * product offers both. A cart holds one line per mode, so switching the picker switches which
 * line the control below is bound to: the shopper sees an add button for a mode they haven't
 * ordered yet and the stepper for one they have.
 */
export function AddToCartForm({ product }: { product: ShopProductDetail }) {
  const { t } = useTranslation()

  const [orderingMode, setOrderingMode] = useState<OrderingModeChoice>(
    product.orderingMode === 'pre_order' ? 'pre_order' : 'in_store',
  )
  const resolvedOrderingMode: OrderingModeChoice =
    product.orderingMode === 'both' ? orderingMode : (product.orderingMode as OrderingModeChoice)

  const line = useCartLine(product.id, resolvedOrderingMode)
  const actions = useCartLineActions({
    productId: product.id,
    orderingMode: resolvedOrderingMode,
    lineId: line?.id,
  })

  return (
    <div className="space-y-3" data-testid="add-to-cart-form">
      {product.orderingMode === 'both' && (
        <SegmentedControl
          value={orderingMode}
          onChange={setOrderingMode}
          options={ORDERING_MODE_CHOICES.map((mode) => ({
            value: mode,
            label: t(`catalog.orderingMode.${mode}`),
            testId: `add-to-cart-orderingmode-${mode}`,
          }))}
        />
      )}
      <AddToCartControl
        product={product}
        line={line}
        actions={actions}
        testIds={{
          signIn: 'add-to-cart-signin',
          add: 'add-to-cart-submit',
          decrease: 'add-to-cart-decrease',
          increase: 'add-to-cart-increase',
          amount: 'add-to-cart-quantity',
        }}
      />
    </div>
  )
}
