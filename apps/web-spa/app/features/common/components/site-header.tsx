import { Badge } from '@grocery/ui/components/primitives/badge'
import { Button } from '@grocery/ui/components/primitives/button'
import { LogOut, ShieldCheck, ShoppingCart, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { AppSettingsMenu } from '@/features/common/components/app-settings-menu'
import { useCartCount } from '@/features/cart/hooks/use-cart-count'
import { useRoles } from '@/features/common/hooks/use-session'
import { authClient } from '@/lib/auth-client'

/**
 * The one top bar for the shop and the member area. Both shells render it so the same
 * controls stay in the same order whether you are browsing the catalogue or reading your
 * cart: settings, cart, back office for admins, account and sign-out once signed in.
 */
export function SiteHeader() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: sessionData } = authClient.useSession()
  const { isAdmin } = useRoles()
  const cartCount = useCartCount()

  const handleLogout = async () => {
    await authClient.signOut()
    navigate('/login')
  }

  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-3">
      <Link to="/shop" className="text-sm font-black uppercase tracking-tight">
        {t('members.title')}
      </Link>
      <div className="flex items-center gap-2">
        <AppSettingsMenu />
        <Button
          variant="ghost"
          size="sm"
          data-testid="site-nav-cart"
          // Signed-out visitors hit MemberAreaLayout's own redirect-to-login guard for `/cart`,
          // which carries no return path — send them through the login page's `redirect` param
          // instead, matching AddToCartForm's sign-in prompt.
          render={<Link to={sessionData ? '/cart' : '/login?redirect=%2Fcart'} />}
        >
          <ShoppingCart className="mr-2 size-4" />
          {t('shop.nav.cart')}
          {cartCount > 0 && (
            <Badge variant="secondary" className="ml-2" data-testid="site-nav-cart-count">
              {cartCount}
            </Badge>
          )}
        </Button>
        {isAdmin && (
          <Button
            variant="ghost"
            size="sm"
            data-testid="site-nav-admin"
            render={<Link to="/admin/members" />}
          >
            <ShieldCheck className="mr-2 size-4" />
            {t('adminMembers.backOffice')}
          </Button>
        )}
        {sessionData ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              data-testid="site-nav-account"
              render={<Link to="/account" />}
            >
              <User className="mr-2 size-4" />
              {t('shop.nav.myAccount')}
            </Button>
            <Button variant="ghost" size="sm" data-testid="nav-logout" onClick={handleLogout}>
              <LogOut className="mr-2 size-4" />
              {t('members.nav.logOut')}
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            data-testid="site-nav-signin"
            render={<Link to="/login" />}
          >
            {t('shop.nav.signIn')}
          </Button>
        )}
      </div>
    </header>
  )
}
