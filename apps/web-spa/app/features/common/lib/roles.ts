export const USER_ROLES = ['member', 'distributor', 'admin'] as const
export type UserRole = (typeof USER_ROLES)[number]

/**
 * Parses the comma-separated Better Auth `role` string into a role list. Mirrors the API's
 * `members.util.ts`: unknown values are dropped, so a role missing from `USER_ROLES` reads
 * back as a plain member.
 */
export function parseRoles(role: string | null | undefined): UserRole[] {
  if (!role) return ['member']
  const known = new Set<string>(USER_ROLES)
  const roles = role
    .split(',')
    .map((part) => part.trim())
    .filter((part): part is UserRole => known.has(part))
  return roles.includes('member') ? roles : ['member', ...roles]
}

export function hasRole(role: string | null | undefined, wanted: UserRole): boolean {
  return parseRoles(role).includes(wanted)
}
