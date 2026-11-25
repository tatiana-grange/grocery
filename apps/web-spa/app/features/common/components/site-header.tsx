import { Badge } from '@grocery/ui/components/primitives/badge'
import { Button } from '@grocery/ui/components/primitives/button'
import { CalendarDays, LogIn, LogOut, ShieldCheck, ShoppingCart, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { AppSettingsMenu } from '@/features/common/components/app-settings-menu'
import { useCartCount } from '@/features/cart/hooks/use-cart-count'
import { PhoneMenu } from '@/features/common/components/phone-menu'
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
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b-2 border-border bg-card px-4 py-3 md:px-6">
      <Link to="/shop" className="font-serif text-xl font-bold">
        {t('members.title')}
      </Link>
      <div className="md:hidden">
        <PhoneMenu isAdmin={isAdmin} isSignedIn={Boolean(sessionData)} onSignOut={handleLogout} />
      </div>
      <nav
        aria-label={t('shop.nav.mainNavigation')}
        className="hidden flex-wrap items-center justify-end gap-1 md:flex"
      >
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
          <ShoppingCart className="size-5" />
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
            <ShieldCheck className="size-5" />
            {t('adminMembers.backOffice')}
          </Button>
        )}
        {sessionData ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              data-testid="site-nav-participation"
              render={<Link to="/participation" />}
            >
              <CalendarDays className="size-5" />
              {t('participation.nav.participation')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              data-testid="site-nav-account"
              render={<Link to="/account" />}
            >
              <User className="size-5" />
              {t('shop.nav.myAccount')}
            </Button>
            <Button variant="ghost" size="sm" data-testid="nav-logout" onClick={handleLogout}>
              <LogOut className="size-5" />
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
            <LogIn className="size-5" />
            {t('shop.nav.signIn')}
          </Button>
        )}
      </nav>
    </header>
  )
}
