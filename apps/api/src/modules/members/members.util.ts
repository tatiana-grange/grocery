import type { EntityManager } from '@mikro-orm/core'
import { UniqueConstraintViolationException } from '@mikro-orm/core'
import type { UserRole } from './contracts/member.contract'
import { User } from '../auth/auth.entity'
import { MemberStatusChange } from './entities/member-status-change.entity'
import { MembershipIntakeSetting } from './entities/membership-intake-setting.entity'
import { Member } from './entities/member.entity'

/** How many times to retry a membership-number collision before giving up. */
const MEMBERSHIP_NUMBER_MAX_ATTEMPTS = 5

/**
 * Generates the next membership number (e.g. `MEM-000123`). Derived from the current row
 * count, so two simultaneous sign-ups can land on the same value — the unique constraint on
 * `Member.membershipNumber` rejects the loser and `persistWithMembershipNumber` retries.
 */
export async function generateMembershipNumber(em: EntityManager): Promise<string> {
  const count = await em.count(Member)
  return `MEM-${String(count + 1).padStart(6, '0')}`
}

/**
 * Assigns a fresh membership number and flushes, retrying on the unique-constraint race that
 * two simultaneous sign-ups (or a sign-up racing an admin-created member) can trigger. Each
 * retry clears the identity map and rebuilds the row via `build`.
 */
export async function persistWithMembershipNumber(
  em: EntityManager,
  build: (membershipNumber: string) => Promise<void> | void,
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    await build(await generateMembershipNumber(em))
    try {
      await em.flush()
      return
    } catch (error) {
      if (
        error instanceof UniqueConstraintViolationException &&
        attempt < MEMBERSHIP_NUMBER_MAX_ATTEMPTS
      ) {
        em.clear()
        continue
      }
      throw error
    }
  }
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

  let member!: Member
  await persistWithMembershipNumber(em, (membershipNumber) => {
    member = new Member()
    member.user = em.getReference(User, userId)
    member.membershipNumber = membershipNumber
    member.status = 'pending'

    const change = new MemberStatusChange()
    change.member = member
    change.toStatus = 'pending'
    member.statusChanges.add(change)

    em.persist([member, change])
  })
  return member
}
