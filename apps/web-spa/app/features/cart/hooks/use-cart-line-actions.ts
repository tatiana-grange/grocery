import type { OrderingModeChoice } from '@grocery/openapi-generator/client/types.gen'
import { useTranslation } from 'react-i18next'
import { useCartMutation } from '@/features/cart/hooks/use-cart-mutation'
import { addCartLine, removeCartLine, updateCartLine } from '@/features/cart/utils/cart-queries'

/** The three writes an add control can trigger, plus whether any of them is in flight. */
export interface CartLineActions {
  add: (quantity: number) => void
  update: (quantity: number) => void
  remove: () => void
  pending: boolean
}

/**
 * Wires the three cart writes for one product: add the line, change its quantity, drop it.
 * Which one a control triggers is settled by whether the line exists, never by a flag, so the
 * shop card, the product page and the cart row all get their writes from here.
 *
 * `lineId` is absent until the product is in the cart; `update` and `remove` are no-ops then,
 * which is exactly when the control shows an add button instead of the stepper.
 */
export function useCartLineActions({
  productId,
  orderingMode,
  lineId,
}: {
  productId: string
  orderingMode: OrderingModeChoice
  lineId?: string
}): CartLineActions {
  const { t } = useTranslation()

  // Only adding can hit the ordering-mode conflict, and only adding and removing are worth a
  // toast — a quantity change shows up in the stepper itself.
  const addMutation = useCartMutation(
    (quantity: number) => addCartLine({ productId, orderingMode, quantity }),
    { success: t('cart.toasts.added'), conflict: t('cart.errors.orderingModeUnavailable') },
  )
  const updateMutation = useCartMutation((variables: { lineId: string; quantity: number }) =>
    updateCartLine(variables.lineId, { quantity: variables.quantity }),
  )
  const removeMutation = useCartMutation((id: string) => removeCartLine(id), {
    success: t('cart.toasts.removed'),
  })

  return {
    add: (quantity) => addMutation.mutate(quantity),
    update: (quantity) => {
      if (lineId) updateMutation.mutate({ lineId, quantity })
    },
    remove: () => {
      if (lineId) removeMutation.mutate(lineId)
    },
    pending: addMutation.isPending || updateMutation.isPending || removeMutation.isPending,
  }
}
