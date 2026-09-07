import type { OrderingModeChoice } from '@grocery/openapi-generator/client/types.gen'
import { useQuery } from '@tanstack/react-query'
import type { CartLine } from '@grocery/openapi-generator/client/types.gen'
import { cartQueryOptions } from '@/features/cart/utils/cart-queries'
import { authClient } from '@/lib/auth-client'

/**
 * The caller's cart line for a product, or undefined when it isn't in the cart. The cart is
 * only fetched for a signed-in visitor; for everyone else there is no line to find.
 *
 * A product offering both ordering modes can have one line per mode, so a caller that knows
 * which mode it is showing passes it and gets that line.
 */
export function useCartLine(
  productId: string,
  orderingMode?: OrderingModeChoice,
): CartLine | undefined {
  const { data: sessionData } = authClient.useSession()
  const { data: cart } = useQuery({ ...cartQueryOptions(), enabled: Boolean(sessionData) })

  return cart?.lines.find(
    (line) =>
      line.product.id === productId && (!orderingMode || line.orderingMode === orderingMode),
  )
}
