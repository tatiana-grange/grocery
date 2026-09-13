import { authClient } from '@/lib/auth-client'
import { hasRole, parseRoles, type UserRole } from '@/features/common/lib/roles'

interface SessionUserLike {
  role?: string | null
}

/**
 * Access roles of the signed-in user (`['member']` when signed out or still loading).
 *
 * `isStaff` is the distribution table's gate: a distributor or an admin. It mirrors the
 * API's `@StaffOnly()`, so an admin passes without holding the `distributor` role.
 */
export function useRoles(): {
  roles: UserRole[]
  isAdmin: boolean
  isDistributor: boolean
  isStaff: boolean
  isPending: boolean
} {
  const { data, isPending } = authClient.useSession()
  const role = (data?.user as SessionUserLike | undefined)?.role
  const isAdmin = hasRole(role, 'admin')
  const isDistributor = hasRole(role, 'distributor')
  return {
    roles: parseRoles(role),
    isAdmin,
    isDistributor,
    isStaff: isAdmin || isDistributor,
    isPending,
  }
}

export function useIsAdmin(): boolean {
  return useRoles().isAdmin
}
