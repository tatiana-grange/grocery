import { AppLoader } from '@grocery/ui/components/app'
import { Navigate, Outlet, useLocation } from 'react-router'
import { MemberShell } from '@/features/common/components/member-shell'
import { authClient } from '@/lib/auth-client'

/**
 * Shell for signed-in members. Same chrome as the shop — the shared MemberShell — plus the
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
    <MemberShell contentClassName="max-w-3xl">
      <Outlet />
    </MemberShell>
  )
}
