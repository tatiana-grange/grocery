import type { ShopProductDetail } from '@grocery/openapi-generator/client/types.gen'
import { Button } from '@grocery/ui/components/primitives/button'
import { Input } from '@grocery/ui/components/primitives/input'
import { toast } from '@grocery/ui/components/primitives/sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import { handleMutationError } from '@/features/common/lib/api-error'
import { addCartLine } from '@/features/cart/utils/cart-queries'
import { authClient } from '@/lib/auth-client'

const ORDERING_MODE_CHOICES = ['pre_order', 'in_store'] as const
type OrderingModeChoice = (typeof ORDERING_MODE_CHOICES)[number]

/**
 * Quantity input plus (when the product supports `both`) an ordering-mode picker, matching
 * the plain-button toggle pattern already used for saleMode/orderingMode elsewhere (no shadcn
 * RadioGroup consumer exists yet in this codebase). Redirects a signed-out visitor to sign in,
 * with a return path back to this product.
 */
export function AddToCartForm({ product }: { product: ShopProductDetail }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { data: sessionData } = authClient.useSession()

  const [quantity, setQuantity] = useState(product.saleMode === 'unit' ? '1' : '1')
  const [orderingMode, setOrderingMode] = useState<OrderingModeChoice>(
    product.orderingMode === 'pre_order' ? 'pre_order' : 'in_store',
  )

  const resolvedOrderingMode: OrderingModeChoice =
    product.orderingMode === 'both' ? orderingMode : (product.orderingMode as OrderingModeChoice)

  const mutation = useMutation({
    mutationFn: () =>
      addCartLine({
        productId: product.id,
        orderingMode: resolvedOrderingMode,
        quantity: Number(quantity),
      }),
    onSuccess: () => {
      toast.success(t('cart.toasts.added'))
      void queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
    onError: (error) =>
      handleMutationError(error, toast.error, {
        conflict: t('cart.errors.orderingModeUnavailable'),
        fallback: t('cart.toasts.error'),
      }),
  })

  if (!sessionData) {
    return (
      <Button
        data-testid="add-to-cart-signin"
        onClick={() => navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`)}
      >
        {t('cart.signInToAdd')}
      </Button>
    )
  }

  const canSubmit = Number(quantity) > 0

  return (
    <div className="space-y-3" data-testid="add-to-cart-form">
      {product.orderingMode === 'both' && (
        <div className="flex gap-2">
          {ORDERING_MODE_CHOICES.map((mode) => (
            <Button
              key={mode}
              type="button"
              size="sm"
              data-testid={`add-to-cart-orderingmode-${mode}`}
              variant={orderingMode === mode ? 'default' : 'outline'}
              onClick={() => setOrderingMode(mode)}
            >
              {t(`catalog.orderingMode.${mode}`)}
            </Button>
          ))}
        </div>
      )}
      <Input
        type="number"
        step={product.saleMode === 'weight' ? '0.001' : '1'}
        min={product.saleMode === 'weight' ? '0.001' : '1'}
        data-testid="add-to-cart-quantity"
        value={quantity}
        onChange={(event) => setQuantity(event.target.value)}
      />
      <Button
        data-testid="add-to-cart-submit"
        disabled={!canSubmit || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {t('cart.addToCart')}
      </Button>
    </div>
  )
}
