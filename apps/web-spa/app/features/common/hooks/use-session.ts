import { authClient } from '@/lib/auth-client'
import { hasRole, parseRoles, type UserRole } from '@/features/common/lib/roles'

interface SessionUserLike {
  role?: string | null
}

/**
 * Access roles of the signed-in user (`['member']` when signed out or still loading).
 */
export function useRoles(): { roles: UserRole[]; isAdmin: boolean; isPending: boolean } {
  const { data, isPending } = authClient.useSession()
  const role = (data?.user as SessionUserLike | undefined)?.role
  return {
    roles: parseRoles(role),
    isAdmin: hasRole(role, 'admin'),
    isPending,
  }
}

export function useIsAdmin(): boolean {
  return useRoles().isAdmin
}
