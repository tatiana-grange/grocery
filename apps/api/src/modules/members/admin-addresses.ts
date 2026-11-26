import type { EntityManager } from '@mikro-orm/core'
import { User } from '../auth/auth.entity'
import { PHONE_EMAIL_DOMAIN, parseRoles } from './members.util'

/** A user's address, or null for the synthetic address of a phone-only account. */
export function realAddress(user: User): string | null {
  return user.email && !user.email.endsWith(`@${PHONE_EMAIL_DOMAIN}`) ? user.email : null
}

/**
 * The real address of every admin who is not banned. Phone-only accounts are skipped, and
 * `onSkipped` hears about each of them so the caller can log it.
 */
export async function findAdminAddresses(
  em: EntityManager,
  onSkipped?: (user: User) => void,
): Promise<string[]> {
  const users = await em.find(User, { banned: false, role: { $like: '%admin%' } })
  const addresses: string[] = []
  for (const user of users) {
    if (!parseRoles(user.role).includes('admin')) continue
    const address = realAddress(user)
    if (address) addresses.push(address)
    else onSkipped?.(user)
  }
  return addresses
}
