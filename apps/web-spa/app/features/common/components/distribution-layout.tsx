import { AppLoader } from '@grocery/ui/components/app'
import { Button } from '@grocery/ui/components/primitives/button'
import { Toaster } from '@grocery/ui/components/primitives/sonner'
import { HandCoins, LogOut, ShieldCheck, Store, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, Outlet, useNavigate } from 'react-router'
import { AppSettingsMenu } from '@/features/common/components/app-settings-menu'
import { useRoles } from '@/features/common/hooks/use-session'
import { authClient } from '@/lib/auth-client'

/**
 * The distribution table. Gated on distributor-or-admin, mirroring the API's `@StaffOnly()`.
 *
 * Deliberately not folded into the back office: that layout gates on `isAdmin` alone, and
 * widening it would mean one layout enforcing two different access rules. Keeping them apart
 * also lets this screen stay sparse — no sidebar, few controls. It is used standing at a
 * table with a queue behind it.
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
      <header className="flex h-14 items-center gap-2 border-b px-4">
        <Link
          to="/distribution"
          className="flex items-center gap-2 text-sm font-black tracking-tight uppercase"
          data-testid="distribution-home-link"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary">
            <HandCoins className="h-3.5 w-3.5 text-primary-foreground" />
          </span>
          {t('distribution.title')}
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" render={<Link to="/shop" />}>
            <Store className="mr-2 size-4" />
            {t('distribution.nav.backToShop')}
          </Button>
          <Button variant="ghost" size="sm" render={<Link to="/account" />}>
            <Users className="mr-2 size-4" />
            {t('members.nav.myAccount')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            data-testid="nav-logout"
            onClick={handleLogout}
            className="text-destructive"
          >
            <LogOut className="mr-2 size-4" />
            {t('members.nav.logOut')}
          </Button>
          <AppSettingsMenu />
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-6">
        <Outlet />
      </main>
      <Toaster position="bottom-right" richColors />
    </div>
  )
}
