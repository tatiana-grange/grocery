import type { EntityManager } from '@mikro-orm/core'
import type { MemberStatus, UserRole } from './contracts/member.contract'
import { createUserData } from '../auth/auth.factory'
import { User } from '../auth/auth.entity'
import { MemberStatusChange } from './entities/member-status-change.entity'
import { MembershipFee } from './entities/membership-fee.entity'
import { Member } from './entities/member.entity'
import { generateMembershipNumber, serializeRoles } from './members.util'

export interface CreateMemberOptions {
  user?: Partial<User>
  password?: string
  status?: MemberStatus
  roles?: UserRole[]
  expectedFeeCents?: number
  profile?: Partial<
    Pick<Member, 'addressLine1' | 'addressLine2' | 'postalCode' | 'city' | 'phone'>
  >
}

export interface MemberWithUser {
  user: User
  member: Member
  fee: MembershipFee
}

/**
 * Test factory: creates an auth user plus its `Member` row, first status-history entry, and
 * membership-fee row. Mirrors `createUserData` so e2e specs can arrange a member directly
 * (the real HTTP sign-up path is exercised manually, not in the mocked-auth e2e harness).
 */
export async function createMemberData(
  em: EntityManager,
  options: CreateMemberOptions = {},
): Promise<MemberWithUser> {
  const roles = options.roles ?? ['member']
  const status = options.status ?? 'active'

  const user = await createUserData(
    em,
    { emailVerified: true, role: serializeRoles(roles), ...options.user },
    options.password,
  )

  const member = new Member()
  member.user = user
  member.membershipNumber = await generateMembershipNumber(em)
  member.status = status
  if (status === 'active') member.joinedAt = new Date()
  Object.assign(member, options.profile ?? {})

  const change = new MemberStatusChange()
  change.member = member
  change.toStatus = status

  const fee = new MembershipFee()
  fee.member = member
  fee.expectedAmountCents = options.expectedFeeCents ?? 0

  em.persist([member, change, fee])
  await em.flush()

  return { user, member, fee }
}
