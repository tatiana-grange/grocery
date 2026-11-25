import { AppLoader, AwningBand } from '@grocery/ui/components/app'
import { Button } from '@grocery/ui/components/primitives/button'
import { Toaster } from '@grocery/ui/components/primitives/sonner'
import { LogOut, ShieldCheck, Store, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, Outlet, useNavigate } from 'react-router'
import { AppSettingsMenu } from '@/features/common/components/app-settings-menu'
import { useRoles } from '@/features/common/hooks/use-session'
import { DistributionMemberSearch } from '@/features/distribution/components/distribution-member-search'
import { authClient } from '@/lib/auth-client'

/**
 * The distribution table. Gated on distributor-or-admin, mirroring the API's `@StaffOnly()`.
 *
 * Deliberately not folded into the back office: that layout gates on `isAdmin` alone, and
 * widening it would mean one layout enforcing two different access rules. Keeping them apart
 * also lets this screen stay sparse — a search column and the page, few controls. It is used
 * standing at a table with a queue behind it.
 */
export default function DistributionLayout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: sessionData, isPending } = authClient.useSession()
  const { isStaff } = useRoles()

  const handleLogout = async () => {
    await authClient.signOut()
    navigate('/login')
  }

  if (isPending) return <AppLoader />
  if (!sessionData) return <Navigate to="/login" replace />
  if (!isStaff) {
    return (
      <div
        className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center"
        data-testid="rbac-access-denied"
      >
        <ShieldCheck className="size-10 text-muted-foreground" />
        <p className="text-lg font-semibold">{t('distribution.accessDenied')}</p>
        <Button render={<Link to="/account" />}>{t('members.nav.myAccount')}</Button>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-background" data-testid="distribution-layout">
      <AwningBand />
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-border bg-card px-6 py-3">
        <Link
          to="/distribution"
          className="font-serif text-3xl font-bold"
          data-testid="distribution-home-link"
        >
          {t('distribution.title')}
        </Link>
        <nav
          aria-label={t('distribution.nav.main')}
          className="ml-auto flex flex-wrap items-center gap-2"
        >
          <Button
            variant="outline"
            data-testid="distribution-nav-shop"
            render={<Link to="/shop" />}
          >
            <Store />
            {t('distribution.nav.backToShop')}
          </Button>
          <Button
            variant="ghost"
            data-testid="distribution-nav-account"
            render={<Link to="/account" />}
          >
            <User />
            {t('members.nav.myAccount')}
          </Button>
          <Button
            variant="ghost"
            data-testid="nav-logout"
            onClick={handleLogout}
            className="text-destructive"
          >
            <LogOut />
            {t('members.nav.logOut')}
          </Button>
          <AppSettingsMenu />
        </nav>
      </header>
      <div className="lg:grid lg:grid-cols-[400px_minmax(0,1fr)]">
        <aside
          aria-label={t('distribution.search.label')}
          className="border-b-2 border-border bg-card p-6 lg:sticky lg:top-0 lg:max-h-svh lg:self-start lg:overflow-y-auto lg:border-r-2 lg:border-b-0"
        >
          <DistributionMemberSearch />
        </aside>
        <main className="min-w-0 p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
      <Toaster position="bottom-right" richColors />
    </div>
  )
}
