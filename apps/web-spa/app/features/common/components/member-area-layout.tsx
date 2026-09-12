import { AppLoader } from '@grocery/ui/components/app'
import { Toaster } from '@grocery/ui/components/primitives/sonner'
import { Navigate, Outlet, useLocation } from 'react-router'
import { SiteHeader } from '@/features/common/components/site-header'
import { authClient } from '@/lib/auth-client'

/**
 * Shell for signed-in members. Same chrome as the shop — the shared SiteHeader — plus the
 * guard that sends signed-out visitors to the login page with a return path.
 */
export default function MemberAreaLayout() {
  const location = useLocation()
  const { data: sessionData, isPending } = authClient.useSession()

  if (isPending) return <AppLoader />
  if (!sessionData) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />
  }

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl p-6">
        <Outlet />
      </main>
      <Toaster position="bottom-right" richColors />
    </div>
  )
}
