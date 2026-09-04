export type UserRole = 'member' | 'admin'

/** Parses the comma-separated Better Auth `role` string into a role list. */
export function parseRoles(role: string | null | undefined): UserRole[] {
  if (!role) return ['member']
  const roles = role
    .split(',')
    .map((part) => part.trim())
    .filter((part): part is UserRole => part === 'member' || part === 'admin')
  return roles.includes('member') ? roles : ['member', ...roles]
}

export function hasRole(role: string | null | undefined, wanted: UserRole): boolean {
  return parseRoles(role).includes(wanted)
}
