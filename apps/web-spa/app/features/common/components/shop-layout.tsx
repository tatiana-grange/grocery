import { Badge } from '@grocery/ui/components/primitives/badge'
import { Button } from '@grocery/ui/components/primitives/button'
import { Toaster } from '@grocery/ui/components/primitives/sonner'
import { ShoppingCart, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet } from 'react-router'
import { useCartCount } from '@/features/cart/hooks/use-cart-count'
import { authClient } from '@/lib/auth-client'

/**
 * Public shell for the shop: no session redirect, reachable signed out. Shows a sign-in link
 * when signed out, and an account link plus a cart-item-count badge when signed in.
 */
export default function ShopLayout() {
  const { t } = useTranslation()
  const { data: sessionData } = authClient.useSession()
  const cartCount = useCartCount()

  return (
    <div className="min-h-svh bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <Link to="/shop" className="text-sm font-black uppercase tracking-tight">
          {t('members.title')}
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            data-testid="shop-nav-cart"
            // Signed-out visitors hit MemberAreaLayout's own redirect-to-login guard for `/cart`,
            // which carries no return path — send them through the login page's `redirect` param
            // instead, matching AddToCartForm's sign-in prompt.
            render={<Link to={sessionData ? '/cart' : '/login?redirect=%2Fcart'} />}
          >
            <ShoppingCart className="mr-2 size-4" />
            {t('shop.nav.cart')}
            {cartCount > 0 && (
              <Badge variant="secondary" className="ml-2" data-testid="shop-nav-cart-count">
                {cartCount}
              </Badge>
            )}
          </Button>
          {sessionData ? (
            <Button
              variant="ghost"
              size="sm"
              data-testid="shop-nav-account"
              render={<Link to="/account" />}
            >
              <User className="mr-2 size-4" />
              {t('shop.nav.myAccount')}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              data-testid="shop-nav-signin"
              render={<Link to="/login" />}
            >
              {t('shop.nav.signIn')}
            </Button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-6">
        <Outlet />
      </main>
      <Toaster position="bottom-right" richColors />
    </div>
  )
}
