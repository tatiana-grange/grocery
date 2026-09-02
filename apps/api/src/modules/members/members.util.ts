import type { EntityManager } from '@mikro-orm/core'
import type { UserRole } from './contracts/member.contract'
import { User } from '../auth/auth.entity'
import { MemberStatusChange } from './entities/member-status-change.entity'
import { MembershipIntakeSetting } from './entities/membership-intake-setting.entity'
import { Member } from './entities/member.entity'

/**
 * Generates the next membership number (e.g. `MEM-000123`). The unique constraint on
 * `Member.membershipNumber` is the backstop against a race.
 */
export async function generateMembershipNumber(em: EntityManager): Promise<string> {
  const count = await em.count(Member)
  return `MEM-${String(count + 1).padStart(6, '0')}`
}

export const PHONE_EMAIL_DOMAIN = 'phone.grocery.local'

/**
 * The synthesized hidden email for a phone-only account. Mirrors the frontend helper —
 * `user.email` is NOT NULL, so a phone-only member gets an address they never see.
 */
export function synthesizedPhoneEmail(phoneNumber: string): string {
  return `${phoneNumber.replace(/[^0-9]/g, '')}@${PHONE_EMAIL_DOMAIN}`
}

/** Whether self-registration is currently accepted. Defaults to open when no row exists yet. */
export async function isMembershipIntakeOpen(em: EntityManager): Promise<boolean> {
  const [setting] = await em.find(MembershipIntakeSetting, {}, { limit: 1 })
  return setting?.open ?? true
}

/** Parses the comma-separated Better Auth `role` string into a role list. */
export function parseRoles(role: string | null | undefined): UserRole[] {
  if (!role) return ['member']
  const roles = role
    .split(',')
    .map((part) => part.trim())
    .filter((part): part is UserRole => part === 'member' || part === 'admin')
  return roles.includes('member') ? roles : ['member', ...roles]
}

/** Serialises a role list back to the Better Auth `role` string. */
export function serializeRoles(roles: UserRole[]): string {
  const unique = Array.from(new Set<UserRole>(['member', ...roles]))
  return unique.join(',')
}

/**
 * Creates the pending `Member` row for a freshly created auth user, plus its first status
 * history entry, in one flush. Idempotent: returns the existing member if there is one.
 * Called from the Better Auth `user.create.after` database hook.
 */
export async function ensurePendingMember(em: EntityManager, userId: string): Promise<Member> {
  const existing = await em.findOne(Member, { user: userId })
  if (existing) return existing

  const member = new Member()
  member.user = em.getReference(User, userId)
  member.membershipNumber = await generateMembershipNumber(em)
  member.status = 'pending'

  const change = new MemberStatusChange()
  change.member = member
  change.toStatus = 'pending'
  member.statusChanges.add(change)

  em.persist([member, change])
  await em.flush()
  return member
}
