import { useQuery } from '@tanstack/react-query'
import { authClient } from '@/lib/auth-client'
import { cartQueryOptions } from '@/features/cart/utils/cart-queries'

/** Number of lines in the caller's cart, or 0 when signed out (the route needs a session). */
export function useCartCount(): number {
  const { data: sessionData } = authClient.useSession()
  const { data } = useQuery({ ...cartQueryOptions(), enabled: Boolean(sessionData) })
  return data?.lines.length ?? 0
}
