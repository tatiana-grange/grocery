import { cn } from '@grocery/ui/lib/utils'
import { CalendarDays, LogIn, ShoppingCart, Store, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import { useCartCount } from '@/features/cart/hooks/use-cart-count'
import { authClient } from '@/lib/auth-client'

interface Tab {
  testId: string
  to: string
  label: string
  Icon: LucideIcon
  showCartCount?: boolean
}

/** The phone navigation of the shop and the member area, fixed at the bottom under 768 px. */
export function MemberTabBar(): ReactElement {
  const { t } = useTranslation()
  const { data: sessionData } = authClient.useSession()
  const cartCount = useCartCount()

  const tabs: Tab[] = sessionData
    ? [
        { testId: 'tab-bar-shop', to: '/shop', label: t('shop.nav.shop'), Icon: Store },
        {
          testId: 'tab-bar-cart',
          to: '/cart',
          label: t('shop.nav.cart'),
          Icon: ShoppingCart,
          showCartCount: true,
        },
        {
          testId: 'tab-bar-participation',
          to: '/participation',
          label: t('participation.nav.participation'),
          Icon: CalendarDays,
        },
        { testId: 'tab-bar-account', to: '/account', label: t('shop.nav.myAccount'), Icon: User },
      ]
    : [
        { testId: 'tab-bar-shop', to: '/shop', label: t('shop.nav.shop'), Icon: Store },
        {
          testId: 'tab-bar-cart',
          to: '/login?redirect=%2Fcart',
          label: t('shop.nav.cart'),
          Icon: ShoppingCart,
        },
        { testId: 'tab-bar-signin', to: '/login', label: t('shop.nav.signIn'), Icon: LogIn },
      ]

  return (
    <nav
      aria-label={t('shop.nav.mainNavigation')}
      data-testid="member-tab-bar"
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className={cn('grid h-(--tab-bar-height)', sessionData ? 'grid-cols-4' : 'grid-cols-3')}>
        {tabs.map(({ testId, to, label, Icon, showCartCount }) => (
          <li key={testId}>
            <NavLink
              to={to}
              end={false}
              data-testid={testId}
              className={({ isActive }) =>
                cn(
                  'flex h-full min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold',
                  isActive ? 'text-foreground' : 'text-muted-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'relative flex h-8 w-14 items-center justify-center rounded-full',
                      isActive ? 'bg-primary text-primary-foreground' : 'bg-transparent',
                    )}
                  >
                    <Icon className="size-6" aria-hidden="true" />
                    {showCartCount && cartCount > 0 && (
                      <>
                        <span
                          aria-hidden="true"
                          data-testid="tab-bar-cart-count"
                          className="absolute -top-1 right-1 h-6 min-w-6 rounded-full bg-warning px-1.5 text-xs leading-6 text-warning-foreground tabular-nums"
                        >
                          {cartCount}
                        </span>
                        <span className="sr-only">
                          {t('shop.nav.cartItems', { count: cartCount })}
                        </span>
                      </>
                    )}
                  </span>
                  <span className="max-w-full truncate px-1">{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
