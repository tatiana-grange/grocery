import { AppLoader } from '@grocery/ui/components/app'
import { Button } from '@grocery/ui/components/primitives/button'
import { Toaster } from '@grocery/ui/components/primitives/sonner'
import { LogOut, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, Outlet, useNavigate } from 'react-router'
import { useRoles } from '@/features/common/hooks/use-session'
import { authClient } from '@/lib/auth-client'

/**
 * Shell for signed-in members. Keeps chrome light: a top bar with the cooperative name,
 * a link into the back office for admins, and sign-out.
 */
export default function MemberAreaLayout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: sessionData, isPending } = authClient.useSession()
  const { isAdmin } = useRoles()

  if (isPending) return <AppLoader />
  if (!sessionData) return <Navigate to="/login" replace />

  const handleLogout = async () => {
    await authClient.signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <Link to="/account" className="text-sm font-black uppercase tracking-tight">
          {t('members.title')}
        </Link>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              data-testid="member-area-back-office"
              render={<Link to="/admin/members" />}
            >
              <ShieldCheck className="mr-2 size-4" />
              {t('adminMembers.backOffice')}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            data-testid="nav-logout"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 size-4" />
            {t('members.nav.logOut')}
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl p-6">
        <Outlet />
      </main>
      <Toaster position="bottom-right" richColors />
    </div>
  )
}
